import axios from 'axios';
import { 
  MajorData, 
  StageData, 
  Team,
  Stage,
  Match,
  Round
} from '../../types/hltvTypes';
import { simulateAllRounds, saveOriginalTeamsFromBackend, debugLog, simulateRoundResults, generateFirstRoundMatches, updatePlayoffBracket, recalculateNextPhaseSeedForQualifiedTeams } from './simulationService';
import { generateSimulatedRounds, setPhaseIdForStatusUpdate } from './roundService';
import { simulatePhase1Completion, simulatePhase2Completion, simulatePhase3Completion } from './phaseService';


const API_URL = 'http://localhost:8000/api'; // URL base para el backend solamente /api para producción

// Variables de estado para los datos del torneo
let majorData: MajorData | null = null;
let localMajorData: MajorData | null = null;
let isDataLoaded = false;
let loadingPromise: Promise<MajorData> | null = null;

// Obtener los datos del torneo desde el backend
export const fetchMajorData = async (forceRefresh = false, slug: string | null = null): Promise<MajorData> => {
  // Si se pide un slug específico, siempre forzar un refresh de los datos para ese torneo.
  // No usar caché local que podría ser de otro torneo.
  if (slug) {
    forceRefresh = true;
    isDataLoaded = false; // Para asegurar que no retorne localMajorData incorrecto
    localMajorData = null;
    loadingPromise = null; // Resetear promesa de carga si es para un slug diferente
  }

  if (isDataLoaded && localMajorData && !forceRefresh) {
    return localMajorData;
  }
  if (loadingPromise && !forceRefresh) {
    return loadingPromise;
  }
  loadingPromise = (async () => {
    try {
      const apiUrl = slug ? `${API_URL}/tournament/data/?slug=${slug}` : `${API_URL}/tournament/data/`;
      debugLog('Fetching data from:', apiUrl);
      const response = await axios.get<MajorData>(apiUrl);
      if (!response.data || !response.data.stages) { // No verificar currentStage aquí, podría no venir si es un torneo no-live
        console.error('API response does not have the expected structure:', response.data);
        throw new Error('La respuesta de la API no tiene la estructura esperada');
      }
      localMajorData = response.data;
      majorData = JSON.parse(JSON.stringify(response.data)); // Copia profunda para el original del backend
      
      // Guardar los equipos originales del backend para preservarlos en futuras simulaciones
      saveOriginalTeamsFromBackend(majorData);
      
      isDataLoaded = true;
      
      // Preservar detalles específicos de los partidos del backend (como scores exactos, hltvId)
      const existingMatchDetails: { 
        [stageId: string]: { [roundIdx: string]: { [matchIdx: string]: Partial<Match> } } 
      } = {}; 

      if (localMajorData) {
        Object.entries(localMajorData.stages).forEach(([stageId, stage]) => {
          existingMatchDetails[stageId] = {};
          stage.rounds.forEach((round, roundIndex) => {
            existingMatchDetails[stageId][roundIndex.toString()] = {};
            round.matches.forEach((match, matchIndex) => {
              existingMatchDetails[stageId][roundIndex.toString()][matchIndex.toString()] = { 
                team1Score: match.team1Score,
                team2Score: match.team2Score,
                map1_team1_score: match.map1_team1_score,
                map1_team2_score: match.map1_team2_score,
                map2_team1_score: match.map2_team1_score,
                map2_team2_score: match.map2_team2_score,
                map3_team1_score: match.map3_team1_score,
                map3_team2_score: match.map3_team2_score,
                hltvMatchId: match.hltvMatchId,
                winner: match.winner // Preservar ganador del backend
              };
            });
          });
        });
      }
      
      await simulateAllRounds(); // Esto regenerará rondas y podría simular ganadores
      
      // Restaurar detalles preservados DESPUÉS de simulateAllRounds
      if (localMajorData) {
        Object.entries(existingMatchDetails).forEach(([stageId, stageDetails]) => {
          if (localMajorData!.stages[stageId]) {
            const stage = localMajorData!.stages[stageId];
            
            // Crear un mapa de los partidos actuales en la fase para búsqueda por nombres
            const currentMatchesMap = new Map<string, Match>();
            stage.rounds.forEach(round => {
              round.matches.forEach(match => {
                const team1 = stage.teams.find(t => t.id === match.team1Id);
                const team2 = stage.teams.find(t => t.id === match.team2Id);
                if (team1 && team2) {
                  const matchKey = [team1.name, team2.name].sort().join(' vs ');
                  currentMatchesMap.set(matchKey, match);
                }
              });
            });

            Object.entries(stageDetails).forEach(([roundIdxStr, roundDetails]) => {
              // roundIdxStr ya no se usa directamente para indexar rounds si la estructura cambió
              Object.entries(roundDetails).forEach(([matchIdxStr, detailsToRestore]) => {
                // matchIdxStr tampoco se usa para indexar matches
                
                const team1Original = majorData?.stages[stageId]?.teams.find(t => t.id === (detailsToRestore as Partial<Match>).team1Id);
                const team2Original = majorData?.stages[stageId]?.teams.find(t => t.id === (detailsToRestore as Partial<Match>).team2Id);

                if (team1Original && team2Original) {
                  const matchKeyToFind = [team1Original.name, team2Original.name].sort().join(' vs ');
                  const targetMatch = currentMatchesMap.get(matchKeyToFind);

                  if (targetMatch) {
                    debugLog(`dataService: Restaurando detalles para ${team1Original.name} vs ${team2Original.name} en targetMatch (ID ${targetMatch.team1Id} vs ${targetMatch.team2Id})`);
                    const simulatedWinner = targetMatch.winner; // Guardar el ganador que la simulación pudo haber puesto
                    const { winner: backendWinnerToRestore, ...otherDetailsToRestore } = detailsToRestore as Partial<Match>;
                    Object.assign(targetMatch, otherDetailsToRestore);

                    if (detailsToRestore.status === 'FINISHED') {
                      targetMatch.winner = backendWinnerToRestore !== undefined ? backendWinnerToRestore : null;
                    } else {
                      if (backendWinnerToRestore !== null && backendWinnerToRestore !== undefined) {
                        targetMatch.winner = backendWinnerToRestore;
                      } else {
                        targetMatch.winner = simulatedWinner;
                      }
                    }
                  } else {
                    debugLog(`dataService: No se encontró el partido ${team1Original.name} vs ${team2Original.name} en currentMatchesMap para restaurar detalles.`);
                  }
                } else {
                  debugLog(`dataService: No se pudieron encontrar los equipos originales para restaurar detalles:`, detailsToRestore);
                }
              });
            });
          }
        });
      }
      
      debugLog('Datos del major cargados y rondas generadas, preservando detalles de partidos del backend.');
      return localMajorData;
    } catch (error) {
      console.error('Error al obtener los datos del major:', error);
      if (localMajorData) {
        debugLog('Usando datos locales existentes debido a error en fetch.');
        isDataLoaded = true;
        return localMajorData;
      }
      throw new Error('No se pudieron cargar los datos del major');
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
};


// Obtener la etapa actual
export const getCurrentStageData = async (): Promise<StageData> => {
  await fetchMajorData();
  const data = localMajorData; 
  if (!data || !data.stages[data.currentStage]) {
    throw new Error('No se pudieron cargar los datos del major o la fase actual no existe.');
  }
  return {
    stageName: data.stages[data.currentStage].name,
    teams: data.stages[data.currentStage].teams || [],
    rounds: data.stages[data.currentStage].rounds || []
  };
};

// Cambiar a otra etapa
export const changeStageSelection = async (stageId: string): Promise<StageData> => {
  await fetchMajorData();
  const data = localMajorData;
  if (!data || !data.stages[stageId]) {
    throw new Error('No se pudieron cargar los datos del major o la fase solicitada no existe.');
  }
  data.currentStage = stageId;
  return getCurrentStageData();
};

// Obtener los datos actuales
export const getCurrentData = (): MajorData | null => {
  return localMajorData;
};

// Obtener equipos de una etapa específica
export const getStageTeams = async (stageId: string): Promise<Team[]> => {
  await fetchMajorData();
  const data = localMajorData;
  if (!data || !data.stages[stageId]) {
    console.warn(`getStageTeams: La fase ${stageId} no existe en los datos cargados.`);
    return [];
  }
  // Para phase2 y phase3, combinar initialTeams y qualifiedTeams si existen.
  // El array `teams` de cada fase debería ser la fuente autoritativa después de la simulación inicial.
  return data.stages[stageId].teams || []; 
};

// Actualizar resultado de un partido
export const updateMatchWinner = async (
  roundIndex: number, 
  matchIndex: number, 
  winnerId: number,
  tournamentSlug: string | null = null, // Slug del torneo específico
  currentStageIdFromPage: string | null = null // StageId desde la página (Home o TournamentPage)
): Promise<MajorData | null> => {
  let tournamentDataToProcess: MajorData | null = null;
  let isSpecificTournament = false;
  // Declarar previousLocalMajorData aquí para que esté en el ámbito correcto
  let previousLocalMajorData: MajorData | null = null; 

  if (tournamentSlug) {
    // Si se proporciona un slug, cargar específicamente ese torneo para procesarlo
    // Esto asegura que la simulación se ejecuta en una copia de los datos de ese torneo.
    debugLog(`updateMatchWinner: Cargando torneo específico con slug: ${tournamentSlug} para simulación aislada.`);
    tournamentDataToProcess = await fetchMajorData(true, tournamentSlug);
    isSpecificTournament = true;
  } else {
    // Si no hay slug, usar los datos cargados globalmente (el torneo "en vivo" o el último consultado sin slug)
    if (!localMajorData) {
      await fetchMajorData(); // Carga el torneo live/default si no hay nada
    }
    tournamentDataToProcess = localMajorData;
    isSpecificTournament = false;
  }

  if (!tournamentDataToProcess) {
    throw new Error('No se pudieron cargar los datos del torneo para actualizar el resultado.');
  }
  
  // Determinar el ID de la fase actual DENTRO DEL CONTEXTO DEL TORNEO A PROCESAR
  // Si viene de una TournamentPage específica, currentStageIdFromPage es la fuente de verdad para ESA página.
  // Si viene de Home (tournamentSlug es null), usamos tournamentDataToProcess.currentStage (que sería el del torneo live).
  const actualCurrentStageId = currentStageIdFromPage || tournamentDataToProcess.currentStage;

  if (!actualCurrentStageId || !tournamentDataToProcess.stages[actualCurrentStageId]) {
    console.error('Error: ID de fase actual no válido o fase no encontrada en los datos del torneo a procesar.');
    // Devolver un StageData vacío o el estado conocido de localMajorData si es un error irrecuperable.
    // MODIFICADO: Devolver null o los datos existentes si el procesamiento falla aquí
    return isSpecificTournament ? null : localMajorData; 
  }

  const stage = tournamentDataToProcess.stages[actualCurrentStageId];
  if (!stage) {
    console.error(`Fase actual ${actualCurrentStageId} no encontrada en dataService.resolveInitialStandingsAndMatches.`);
    return localMajorData;
  }
  if (!stage.rounds || !stage.rounds[roundIndex] || !stage.rounds[roundIndex].matches[matchIndex]) {
    console.error('Error: Partido o ronda no encontrado para actualizar dentro del torneo procesado.', actualCurrentStageId, roundIndex, matchIndex);
    // Devolver datos del torneo procesado hasta ahora o null
    return tournamentDataToProcess; 
  }

  const match = stage.rounds[roundIndex].matches[matchIndex];
  if (match.winner === winnerId) {
    debugLog("El ganador seleccionado es el mismo, no se requieren cambios.");
    // Devolver los datos sin cambios
    return tournamentDataToProcess;
  }

  debugLog(`Actualizando resultado en ${tournamentDataToProcess.name} (${actualCurrentStageId}), Ronda ${roundIndex + 1}, Partido ${matchIndex + 1}, Nuevo Ganador: ${winnerId}`);
  match.winner = winnerId;

  // --- INICIO LÓGICA ESPECIAL PLAYOFFS ---
  const isPlayoffStage = actualCurrentStageId === 'phase4' || 
                         stage.type === 'PLAYOFF' || 
                         stage.name.toLowerCase().includes('playoff');

  if (isPlayoffStage) {
    debugLog(`Playoff stage detected (${actualCurrentStageId}). Updating bracket directly.`);
    // Update the team slots in the next round based on the new winner.
    updatePlayoffBracket(stage);

    // updatePlayoffBracket only fixes team1Id/team2Id; if the next round's existing
    // winner no longer belongs to the new pairing, the cascade gets stuck. Re-simulate
    // any orphaned match with the favorite (lower seed) so SF and Final follow QF.
    const reSimulateIfWinnerOrphaned = (m: Match | undefined) => {
      if (!m || !m.team1Id || !m.team2Id) return;
      const winnerStillInMatch = m.winner === m.team1Id || m.winner === m.team2Id;
      if (winnerStillInMatch) return;
      const t1 = stage.teams.find(t => t.id === m.team1Id);
      const t2 = stage.teams.find(t => t.id === m.team2Id);
      if (!t1 || !t2) return;
      const t1Seed = t1.seed ?? Infinity;
      const t2Seed = t2.seed ?? Infinity;
      m.winner = t1Seed <= t2Seed ? m.team1Id : m.team2Id;
      debugLog(`Re-simulado partido playoff con winner huérfano: ${t1.name} vs ${t2.name} -> ${m.winner === t1.id ? t1.name : t2.name}`);
    };

    if (roundIndex === 0) {
      // QF changed -> re-simulate any orphaned SF, then propagate to the Final
      stage.rounds[1]?.matches?.forEach(reSimulateIfWinnerOrphaned);
      updatePlayoffBracket(stage);
      reSimulateIfWinnerOrphaned(stage.rounds[2]?.matches?.[0]);
    } else if (roundIndex === 1) {
      // SF changed -> the Final slot just moved, re-simulate it if needed
      reSimulateIfWinnerOrphaned(stage.rounds[2]?.matches?.[0]);
    }

    updateRoundStatusesLocal(stage);
  } else {
    // --- INICIO LÓGICA FASES SUIZAS (Existente) ---
    const preservedResultsForStage: { [roundIdx: string]: { [matchIdx: string]: Partial<Match> } } = {};
    stage.rounds.forEach((r, rIdx) => {
      preservedResultsForStage[rIdx.toString()] = {};
      r.matches.forEach((m, mIdx) => {
        if (m.winner !== null || m.team1Score !== undefined) {
          preservedResultsForStage[rIdx.toString()][mIdx.toString()] = { ...m };
        }
      });
    });
    if (!preservedResultsForStage[roundIndex.toString()]) preservedResultsForStage[roundIndex.toString()] = {};
    preservedResultsForStage[roundIndex.toString()][matchIndex.toString()] = { ...match };

    for (let i = roundIndex + 1; i < stage.rounds.length; i++) {
      stage.rounds[i].matches = [];
    }

    if (isSpecificTournament) {
      previousLocalMajorData = localMajorData ? JSON.parse(JSON.stringify(localMajorData)) : null;
      localMajorData = tournamentDataToProcess; // Sobreescribir temporalmente para simulación
    }

    setPhaseIdForStatusUpdate(actualCurrentStageId);
    await generateSimulatedRounds(actualCurrentStageId, preservedResultsForStage);

    // Lógica de propagación de fases adaptada y dinámica
    const simulateAndPropagatePhases = async (currentTournamentData: MajorData, initialChangedStageId: string) => {
      const stageKeys = Object.keys(currentTournamentData.stages).sort((a, b) => {
        const numA = parseInt(a.replace('phase', ''), 10);
        const numB = parseInt(b.replace('phase', ''), 10);
        return numA - numB;
      });

      // Guarda una copia de todos los equipos originales por fase antes de empezar la propagación.
      // "Originales" = equipos que no han llegado a la fase por promoción de una fase anterior.
      const originalTeamsByStage: {[stageId: string]: Team[]} = {};
      stageKeys.forEach(stageId => {
        const stageData = currentTournamentData.stages[stageId];
        if (stageId !== initialChangedStageId && stageData?.teams) {
          const stageIsPlayoff =
            stageData.type === 'PLAYOFF' ||
            stageData.name?.toLowerCase().includes('playoff') ||
            stageData.name?.toLowerCase().includes('champions') ||
            stageId === 'phase4';

          let trulyOriginalTeams: Team[] = [];

          if (stageIsPlayoff) {
            // En playoffs (sin importar el slot), los re-seeds de los advancers caen en 1..8
            // y se confundirían con "originales". La bandera isPromoted es la única señal
            // confiable; si no hay equipos invitados directos al playoff, la lista queda vacía.
            trulyOriginalTeams = stageData.teams.filter(t => !t.isPromoted);
            debugLog(`Filtrados ${trulyOriginalTeams.length} equipos originales de ${stageId} (playoff, usando !isPromoted) de un total de ${stageData.teams.length}`);
          } else if (stageId === 'phase2') {
            trulyOriginalTeams = stageData.teams.filter(t => t.seed >= 9 && t.seed <= 16);
            debugLog(`Filtrados ${trulyOriginalTeams.length} equipos REALMENTE originales de ${stageId} (seeds 9-16) de un total de ${stageData.teams.length}`);
          } else if (stageId === 'phase3') {
            trulyOriginalTeams = stageData.teams.filter(t => t.seed >= 1 && t.seed <= 8);
            debugLog(`Filtrados ${trulyOriginalTeams.length} equipos REALMENTE originales de ${stageId} (seeds 1-8) de un total de ${stageData.teams.length}`);
          } else {
            trulyOriginalTeams = stageData.teams.filter(t => !t.isPromoted);
            debugLog(`Filtrados ${trulyOriginalTeams.length} equipos no promovidos de ${stageId} (usando isPromoted) de un total de ${stageData.teams.length}`);
          }

          originalTeamsByStage[stageId] = JSON.parse(JSON.stringify(trulyOriginalTeams));
          debugLog(`Guardados ${originalTeamsByStage[stageId].length} equipos originales de la fase ${stageId} antes de la propagación`);
        }
      });

      // Esta variable mantiene un registro de qué fases han sido modificadas en sus equipos
      const modifiedStages = new Set<string>([initialChangedStageId]);
      
      let currentStageIdx = stageKeys.indexOf(initialChangedStageId);

      while (currentStageIdx < stageKeys.length) {
        const currentStageIdToProcess = stageKeys[currentStageIdx];
        const currentStageData = currentTournamentData.stages[currentStageIdToProcess];

        if (!currentStageData) {
          debugLog(`Propagación: Fase ${currentStageIdToProcess} no encontrada, deteniendo propagación.`);
          break;
        }

        const teamsReadyToAdvance = currentStageData.teams.some(t => (t.wins || 0) === 3 || (t.losses || 0) === 3);
        const isPlayoffStage = currentStageData.name.toLowerCase().includes('playoff') || currentStageData.type === 'PLAYOFF' || currentStageIdToProcess === 'phase4';
        
        // Para playoffs, la propia simulación de generateSimulatedRounds('phase4') ya maneja el avance interno del bracket.
        // Solo necesitamos asegurarnos de que se llame a generateSimulatedRounds para ella si es la fase afectada.
        // La propagación de una fase suiza A playoffs sí requiere llamar a simulatePhaseXCompletion.
        if (isPlayoffStage && initialChangedStageId === currentStageIdToProcess) {
           // Si el cambio fue EN una fase de playoffs, la simulación de esa fase ya se hizo arriba.
           // No necesitamos hacer más aquí para ESTA fase de playoff, se rompe el bucle de propagación para ella.
           // Sin embargo, si la fase ANTERIOR a una playoff completó y llenó esta playoff, generateSimulatedRounds para la playoff SÍ debe correr.
           // Esto se maneja en el bloque de abajo cuando nextStageId es la playoff.
           debugLog(`Propagación: ${currentStageIdToProcess} es una fase de playoffs. La simulación específica ya ocurrió o se manejará si es 'siguiente fase'.`);
           // No necesariamente rompemos, podría haber una fase después de los playoffs (muy raro, pero por si acaso)
           if (currentStageIdx === stageKeys.length -1) break; // Si es la última fase, seguro paramos.
        }

        if (!teamsReadyToAdvance && !isPlayoffStage) {
          debugLog(`Propagación: No hay equipos listos para avanzar desde ${currentStageIdToProcess}, deteniendo.`);
          break;
        }

        const nextStageIdx = currentStageIdx + 1;
        if (nextStageIdx >= stageKeys.length) {
          debugLog(`Propagación: ${currentStageIdToProcess} es la última fase definida, no hay más propagación.`);
          break;
        }

        const nextStageId = stageKeys[nextStageIdx];
        if (!currentTournamentData.stages[nextStageId]) {
          debugLog(`Propagación: Siguiente fase ${nextStageId} no está definida en el torneo, deteniendo.`);
          break;
        }
        
        debugLog(`Propagación: Equipos listos para avanzar de ${currentStageIdToProcess} o es playoff. Verificando siguiente fase: ${nextStageId}`);

        // ✨ MODIFICACIÓN: Guardamos los equipos originales de la siguiente fase antes de simular
        const originalNextStageTeams = originalTeamsByStage[nextStageId] || [];
        if (originalNextStageTeams.length > 0) {
          debugLog(`Restaurando ${originalNextStageTeams.length} equipos originales para la fase ${nextStageId} antes de la simulación`);
        }

        let qualifiedTeams: Team[] = [];
        let simulationForNextStageNeeded = false;

        if (currentStageIdToProcess === 'phase1') {
          qualifiedTeams = await simulatePhase1Completion(); // Opera sobre getCurrentData(), que es localMajorData (copia del torneo específico si aplica)
          simulationForNextStageNeeded = true;
          modifiedStages.add(nextStageId); // Marcar la siguiente fase como modificada
        } else if (currentStageIdToProcess === 'phase2') {
          qualifiedTeams = await simulatePhase2Completion();
          simulationForNextStageNeeded = true;
          modifiedStages.add(nextStageId); // Marcar la siguiente fase como modificada
        } else if (currentStageIdToProcess === 'phase3') {
          qualifiedTeams = await simulatePhase3Completion();
          simulationForNextStageNeeded = true;
          modifiedStages.add(nextStageId); // Marcar la siguiente fase como modificada
        }
        // Si currentStageIdToProcess es playoffs, qualifiedTeams no se usa para popular la siguiente, ya que no hay.

        if (simulationForNextStageNeeded && currentTournamentData.stages[nextStageId]) {
          debugLog(`Propagación: Se llamó a la función de completado para ${currentStageIdToProcess}. Ahora simulando ${nextStageId}.`);
          
          // ✨ MODIFICACIÓN: Incluye equipos originales en la siguiente fase antes de simularla
          if (qualifiedTeams.length > 0) {
            debugLog(`Mezclando ${qualifiedTeams.length} equipos clasificados con ${originalNextStageTeams.length} equipos originales en ${nextStageId}`);
            
            // Recalcular el seeding para los equipos clasificados según la fase de destino.
            // Playoffs (sin importar el slot phaseN) reciben seeds 1..8 para que
            // generatePlayoffBracket los empareje high-vs-low correctamente.
            let recalculatedQualifiedTeams = [...qualifiedTeams];
            const nextStageData = currentTournamentData.stages[nextStageId];
            const nextStageIsPlayoff =
              nextStageData?.type === 'PLAYOFF' ||
              nextStageData?.name?.toLowerCase().includes('playoff') ||
              nextStageData?.name?.toLowerCase().includes('champions') ||
              nextStageId === 'phase4' ||
              nextStageId.toLowerCase().includes('playoff');

            if (nextStageIsPlayoff) {
              recalculatedQualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 1);
              debugLog(`Seeding recalculado para equipos que avanzan a playoffs (${nextStageId}): Comienza en 1`);
            } else if (nextStageId === 'phase2') {
              recalculatedQualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 17);
              debugLog(`Seeding recalculado para equipos que avanzan a phase2: Comienza en 17`);
            } else if (nextStageId === 'phase3') {
              recalculatedQualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 9);
              debugLog(`Seeding recalculado para equipos que avanzan a phase3 swiss: Comienza en 9`);
            }
            
            // Marcamos los equipos promovidos y reseteamos sus estadísticas
            const promotedTeams = recalculatedQualifiedTeams.map(team => ({
              ...team,
              wins: 0,
              losses: 0,
              buchholzScore: 0,
              opponents: [],
              isPromoted: true
            }));
            
            // Combinamos equipos originales (prioridad) con equipos promovidos
            const combinedTeams = [...originalNextStageTeams];
            const existingIds = new Set(originalNextStageTeams.map(t => t.id));
            
            // Solo añadir equipos que no existan ya por ID
            promotedTeams.forEach(team => {
              if (!existingIds.has(team.id)) {
                combinedTeams.push(team);
              }
            });
            
            // Asignar los equipos combinados a la siguiente fase
            currentTournamentData.stages[nextStageId].teams = combinedTeams;
            debugLog(`Fase ${nextStageId} ahora tiene ${combinedTeams.length} equipos combinados`);
            
            // Verificar si la composición de equipos cambió comparando con una copia anterior
            if (originalTeamsByStage[nextStageId]) {
              const prevTeamIds = new Set(originalTeamsByStage[nextStageId].map(t => t.id));
              const newTeamIds = new Set(currentTournamentData.stages[nextStageId].teams.map(t => t.id));
              
              let teamsDiffer = false;
              
              // Verificar si falta algún ID previo o si hay algún ID nuevo
              for (const id of Array.from(prevTeamIds)) {
                if (!newTeamIds.has(id)) {
                  teamsDiffer = true;
                  break;
                }
              }
              
              if (!teamsDiffer) {
                for (const id of Array.from(newTeamIds)) {
                  if (!prevTeamIds.has(id)) {
                    teamsDiffer = true;
                    break;
                  }
                }
              }
              
              if (teamsDiffer) {
                debugLog(`⚠️ La composición de equipos en ${nextStageId} ha cambiado. Se requiere regeneración completa de partidos.`);
                // En este caso, ya hemos marcado la fase con modifiedStages.add(nextStageId)
              }
            }
          } else if (originalNextStageTeams.length > 0) {
            // Si no hay equipos clasificados pero sí hay originales, mantener los originales
            currentTournamentData.stages[nextStageId].teams = originalNextStageTeams;
            debugLog(`No hay equipos clasificados, manteniendo ${originalNextStageTeams.length} equipos originales en ${nextStageId}`);
          }
          
          // IMPORTANTE: Reiniciar completamente las rondas si:
          // 1. Esta fase ha sido modificada en sus equipos
          // 2. Es fase siguiente inmediata de la fase inicialmente modificada
          const shouldResetRounds = modifiedStages.has(nextStageId) || currentStageIdx === stageKeys.indexOf(initialChangedStageId);
          
          if (shouldResetRounds) {
            debugLog(`🔄 Regenerando completamente las rondas de la fase ${nextStageId} debido a cambios en equipos`);
            // Resetear todas las rondas de la fase
            currentTournamentData.stages[nextStageId].rounds = [];
            // No preservamos resultados existentes para forzar regeneración completa
            setPhaseIdForStatusUpdate(nextStageId);
            await generateSimulatedRounds(nextStageId); // Sin preservedResults para regenerar todo
          } else {
            // Resetear rondas y simular con los equipos combinados pero preservando resultados
            currentTournamentData.stages[nextStageId].rounds = [];
            setPhaseIdForStatusUpdate(nextStageId);
            await generateSimulatedRounds(nextStageId); // Simular la siguiente fase si existe
          }
          
          // Marcar esta fase como procesada para propagar cambios a la siguiente
          modifiedStages.add(nextStageId);
        } else if (!simulationForNextStageNeeded && isPlayoffStage) {
          // Para fases de playoffs, quizás queramos restaurar equipos originales
          if (originalNextStageTeams.length > 0) {
            debugLog(`Restaurando ${originalNextStageTeams.length} equipos originales en fase de playoffs ${nextStageId}`);
            // Restaurar solo si no hay equipos o si hay menos equipos que los originales
            if (!currentTournamentData.stages[nextStageId].teams || 
                currentTournamentData.stages[nextStageId].teams.length < originalNextStageTeams.length) {
              currentTournamentData.stages[nextStageId].teams = originalNextStageTeams;
            }
          }
        } else {
          debugLog(`Propagación: No se necesita simulación para ${nextStageId} o ya se manejó.`);
        }
        
        currentStageIdx++; // Avanzar al siguiente índice de fase para continuar la propagación en cascada
      }
      
      // Log final sobre las fases modificadas
      if (modifiedStages.size > 0) {
        debugLog(`Fases modificadas durante la propagación: ${Array.from(modifiedStages).join(', ')}`);
      }
    };

    await simulateAndPropagatePhases(tournamentDataToProcess, actualCurrentStageId);
    updateRoundStatusesLocal(tournamentDataToProcess.stages[actualCurrentStageId]);

    // --- FIN LÓGICA FASES SUIZAS ---
  }
  // --- FIN LÓGICA ESPECIAL PLAYOFFS ---

  if (isSpecificTournament) {
    // Si estábamos procesando un torneo específico (no el global "live"):
    if (!isPlayoffStage && previousLocalMajorData !== null) {
      localMajorData = previousLocalMajorData;
      debugLog(`updateMatchWinner: Simulación aislada para ${tournamentSlug} (fase suiza) completada. localMajorData global restaurado.`);
    } else if (isPlayoffStage) {
      debugLog(`updateMatchWinner: Modificación directa para ${tournamentSlug} (playoffs) completada. No se toca localMajorData global.`);
    }
  }
  
  // Devolver los datos de la fase actual del torneo que fue procesado.
  return tournamentDataToProcess;
};

// Función local para actualizar estados de rondas, para no depender del phaseId global de roundService
function updateRoundStatusesLocal(stage: Stage): void {
  if (!stage.rounds) return;
  
  // Paso 1: Marcar rondas como 'completed' si todos sus partidos tienen ganador
  for (let i = 0; i < stage.rounds.length; i++) {
    const currentRound = stage.rounds[i];
    const allMatchesHaveWinner = currentRound.matches.every(m => m.winner !== null);
    if (allMatchesHaveWinner && currentRound.matches.length > 0) {
      currentRound.status = 'completed';
    } else {
      // Si no está completa, la marcamos inicialmente como 'pending'. 
      // La lógica posterior determinará si debe ser 'active'.
      // Evitamos poner 'active' aquí prematuramente.
      if (currentRound.status !== 'completed') { // No sobrescribir si ya estaba completada
          currentRound.status = 'pending';
      }
    }
  }

  // Paso 2: Encontrar la primera ronda no completada con partidos poblados y marcarla como 'active'
  let activeRoundSet = false;
  for (let i = 0; i < stage.rounds.length; i++) {
    const round = stage.rounds[i];
    if (round.status === 'completed') {
      continue;
    }

    // Verificar si la ronda tiene partidos y si esos partidos tienen equipos asignados (no IDs 0)
    const hasPopulatedMatches = round.matches.length > 0 && 
                                round.matches.some(m => m.team1Id !== 0 && m.team2Id !== 0);

    if (!activeRoundSet && hasPopulatedMatches) {
      // Esta es la primera ronda no completada y lista para jugar
      round.status = 'active';
      activeRoundSet = true;
    } else {
       // Todas las demás rondas no completadas (posteriores a la activa, o sin partidos poblados)
       // deben estar pendientes.
       round.status = 'pending';
    }
  }
  
   // Debug log para ver el resultado final
  debugLog(`Local UpdateRoundStatuses para ${stage.name}: Activa: ${stage.rounds.find(r => r.status === 'active')?.roundNumber || 'Ninguna'}. Completadas: ${stage.rounds.filter(r => r.status === 'completed').map(r => r.roundNumber).join(', ')}`);
}