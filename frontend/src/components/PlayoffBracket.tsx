import React from "react";
import { Match, Round, Team } from "../types/hltvTypes";

interface PlayoffBracketProps {
  teams: Team[];
  rounds: Round[]; // rounds[0] = QF, rounds[1] = SF, rounds[2] = Final
  onMatchResult: (roundIndex: number, matchIndex: number, winnerId: number) => void;
}

// ---------- helpers ---------------------------------------------------------

const logoSrcFor = (teamName: string | undefined): string => {
  if (!teamName) return "/team-logos/default.png";
  const slug = teamName.toLowerCase().replace(/\s+/g, "").replace(/[^\w-]/g, "");
  return `/team-logos/${slug}.png`;
};

const fallbackLogo = (e: React.SyntheticEvent<HTMLImageElement>) => {
  (e.target as HTMLImageElement).src = "/team-logos/default.png";
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- TeamRow (compact) -----------------------------------------------

interface TeamRowProps {
  team: Team | undefined;
  score: number | undefined;
  isWinner: boolean;
  isLoser: boolean;
  isFinished: boolean;
  onPick: () => void;
}

const TeamRow: React.FC<TeamRowProps> = ({
  team,
  score,
  isWinner,
  isLoser,
  isFinished,
  onPick,
}) => {
  const isClickable = !isFinished && Boolean(team);
  const isTBD = !team;
  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={isClickable ? onPick : undefined}
      className={cx(
        "group w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
        isClickable ? "cursor-pointer hover:bg-primary-500/20" : "cursor-default",
        isWinner && !isLoser && "bg-primary-600/25",
      )}
    >
      {team ? (
        <img
          src={logoSrcFor(team.name)}
          alt=""
          className={cx(
            "h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 object-contain",
            isLoser && "grayscale opacity-60",
          )}
          onError={fallbackLogo}
        />
      ) : (
        <span className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 rounded bg-neutral-800/70 grid place-items-center text-neutral-700 text-xs">
          ?
        </span>
      )}
      <span
        className={cx(
          "flex-1 min-w-0 truncate text-fluid-sm",
          isTBD ? "text-neutral-600 italic" : isWinner ? "text-white font-semibold" : isLoser ? "text-neutral-500" : "text-neutral-200",
        )}
      >
        {team ? team.name : "TBD"}
      </span>
      <span
        className={cx(
          "min-w-[1rem] text-right font-mono tabular-nums text-fluid-sm",
          isWinner ? "text-white font-semibold" : "text-neutral-600",
        )}
      >
        {typeof score === "number" ? score : "—"}
      </span>
    </button>
  );
};

// ---------- MatchCard -------------------------------------------------------

interface MatchCardProps {
  match: Match | undefined;
  roundIndex: number;
  matchIndex: number;
  teams: Team[];
  onPickWinner: (roundIndex: number, matchIndex: number, winnerId: number) => void;
  emphasize?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  roundIndex,
  matchIndex,
  teams,
  onPickWinner,
  emphasize,
}) => {
  const t1 = match ? teams.find((t) => t.id === match.team1Id) : undefined;
  const t2 = match ? teams.find((t) => t.id === match.team2Id) : undefined;
  const isFinished = match?.status === "FINISHED";
  const isLive = match?.status === "LIVE";
  const winnerId = match?.winner ?? null;

  const pick = (id: number | undefined) => {
    if (!id || !match || isFinished) return;
    onPickWinner(roundIndex, matchIndex, id);
  };

  return (
    <article
      className={cx(
        "relative w-full rounded-md overflow-hidden border bg-neutral-900/80 shadow-sm",
        emphasize ? "border-primary-500/60 shadow-lg shadow-primary-900/30" : "border-neutral-800",
      )}
    >
      {isLive && (
        <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-danger-500 text-white text-[9px] font-bold rounded-full animate-pulse">
          LIVE
        </span>
      )}
      <div className="divide-y divide-neutral-800">
        <TeamRow
          team={t1}
          score={match?.team1Score}
          isWinner={winnerId !== null && winnerId === match?.team1Id}
          isLoser={winnerId !== null && winnerId !== match?.team1Id}
          isFinished={isFinished}
          onPick={() => pick(t1?.id)}
        />
        <TeamRow
          team={t2}
          score={match?.team2Score}
          isWinner={winnerId !== null && winnerId === match?.team2Id}
          isLoser={winnerId !== null && winnerId !== match?.team2Id}
          isFinished={isFinished}
          onPick={() => pick(t2?.id)}
        />
      </div>
    </article>
  );
};

// ---------- ChampionCard ----------------------------------------------------

const ChampionCard: React.FC<{ champion: Team | null }> = ({ champion }) => (
  <div
    className={cx(
      "relative overflow-hidden rounded-lg border-2 p-4 text-center transition-all",
      champion
        ? "border-yellow-400/80 bg-gradient-to-br from-yellow-500/30 via-amber-700/15 to-neutral-900 shadow-lg shadow-yellow-500/20"
        : "border-neutral-800 bg-neutral-900/70",
    )}
  >
    <p
      className={cx(
        "text-[10px] font-bold tracking-[0.3em] uppercase mb-2 flex items-center justify-center gap-1.5",
        champion ? "text-yellow-300" : "text-neutral-600",
      )}
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M5 4h14v2h2v3a4 4 0 01-4 4h-.5a5.5 5.5 0 01-5 4.49V20h3v2H9v-2h3v-2.51A5.5 5.5 0 017.5 13H7a4 4 0 01-4-4V6h2V4zm0 4v1a2 2 0 002 2V8H5zm14 0h-2v3a2 2 0 002-2V8z" />
      </svg>
      Campeón
    </p>
    {champion ? (
      <>
        <img
          src={logoSrcFor(champion.name)}
          alt={champion.name}
          className="w-14 h-14 sm:w-16 sm:h-16 object-contain mx-auto mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
          onError={fallbackLogo}
        />
        <p className="text-fluid-base font-bold text-white truncate">{champion.name}</p>
        <p className="text-fluid-xs text-yellow-200/70 mt-1">Seed #{champion.seed ?? "?"}</p>
      </>
    ) : (
      <div className="py-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800/80 grid place-items-center text-2xl text-neutral-700 font-mono">
          ?
        </div>
        <p className="text-fluid-xs text-neutral-500 mt-2">Por decidir</p>
      </div>
    )}
  </div>
);

// ---------- Column wrapper --------------------------------------------------

interface ColumnProps {
  title: string;
  justify: "between" | "around" | "center";
  children: React.ReactNode;
  widthClass?: string;
}

const Column: React.FC<ColumnProps> = ({ title, justify, children, widthClass = "w-44 lg:w-52" }) => (
  <div className={cx("flex flex-col flex-shrink-0", widthClass)}>
    <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase text-neutral-400 text-center mb-4">
      {title}
    </h3>
    <div
      className={cx(
        "flex-1 flex flex-col gap-3",
        justify === "between" && "justify-between",
        justify === "around" && "justify-around",
        justify === "center" && "justify-center",
      )}
    >
      {children}
    </div>
  </div>
);

// ---------- Main ------------------------------------------------------------

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ teams, rounds, onMatchResult }) => {
  const qf = rounds[0]?.matches || [];
  const sf = rounds[1]?.matches || [];
  const finalMatch = rounds[2]?.matches?.[0];

  const champion: Team | null =
    finalMatch && finalMatch.winner !== null
      ? teams.find((t) => t.id === finalMatch.winner) || null
      : null;

  const renderMatch = (
    m: Match | undefined,
    roundIndex: number,
    matchIndex: number,
    emphasize = false,
  ) => (
    <MatchCard
      match={m}
      roundIndex={roundIndex}
      matchIndex={matchIndex}
      teams={teams}
      onPickWinner={onMatchResult}
      emphasize={emphasize}
    />
  );

  return (
    <div className="w-full">
      {/* ============== DESKTOP — horizontal 4-column bracket ============== */}
      <div className="hidden md:flex md:items-stretch md:justify-center md:gap-8 lg:gap-12 md:min-h-[460px]">
        <Column title="Cuartos" justify="between">
          {renderMatch(qf[0], 0, 0)}
          {renderMatch(qf[1], 0, 1)}
          {renderMatch(qf[2], 0, 2)}
          {renderMatch(qf[3], 0, 3)}
        </Column>

        <Column title="Semifinales" justify="around">
          {renderMatch(sf[0], 1, 0)}
          {renderMatch(sf[1], 1, 1)}
        </Column>

        <Column title="Final" justify="center">
          {finalMatch ? (
            renderMatch(finalMatch, 2, 0, true)
          ) : (
            <p className="text-fluid-xs text-neutral-600 italic text-center">Pendiente</p>
          )}
        </Column>

        <Column title="Campeón" justify="center" widthClass="w-48 lg:w-56">
          <ChampionCard champion={champion} />
        </Column>
      </div>

      {/* ============== MOBILE — vertical compact stack ============== */}
      <div className="md:hidden space-y-6">
        <ChampionCard champion={champion} />

        <section>
          <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase text-neutral-400 mb-2">
            Cuartos
          </h3>
          <div className="space-y-2">
            {qf.length > 0
              ? qf.map((m, i) => <React.Fragment key={`qf-${i}`}>{renderMatch(m, 0, i)}</React.Fragment>)
              : <p className="text-fluid-xs text-neutral-600 italic">Pendiente.</p>}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase text-neutral-400 mb-2">
            Semifinales
          </h3>
          <div className="space-y-2">
            {sf.length > 0
              ? sf.map((m, i) => <React.Fragment key={`sf-${i}`}>{renderMatch(m, 1, i)}</React.Fragment>)
              : <p className="text-fluid-xs text-neutral-600 italic">Pendiente.</p>}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase text-neutral-400 mb-2">
            Final
          </h3>
          {finalMatch ? (
            renderMatch(finalMatch, 2, 0, true)
          ) : (
            <p className="text-fluid-xs text-neutral-600 italic">Pendiente.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default PlayoffBracket;
