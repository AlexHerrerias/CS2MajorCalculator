"""Rename HLTV-named entities to neutral names and add Liquipedia integration field.

- Match.last_hltv_update     -> Match.last_external_update (RenameField; data preserved)
- Match.hltv_match_id         -> kept; only help_text updated (legacy id)
- Match.liquipedia_page_name  -> NEW field, nullable, blank
- HLTVUpdateSettings model    -> MatchUpdateSettings (RenameModel; row preserved)
- MatchUpdateSettings.use_real_api -> use_liquipedia_api (RenameField; data preserved)
- Help text and verbose name updates for the renamed model.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0007_fantasyphasepick_team_points_breakdown_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="match",
            old_name="last_hltv_update",
            new_name="last_external_update",
        ),
        migrations.AlterField(
            model_name="match",
            name="hltv_match_id",
            field=models.IntegerField(
                blank=True,
                help_text="(Legacy) ID numérico del partido en HLTV.org. Conservado por datos previos; nuevas integraciones usan liquipedia_page_name.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="match",
            name="last_external_update",
            field=models.DateTimeField(
                blank=True,
                help_text="Última vez que se actualizaron los datos desde una fuente externa (Liquipedia).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="liquipedia_page_name",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Page name del partido en Liquipedia "
                    "(ej: 'MajorChampionship/2024/Stage_A/Round_1_Match_1'). "
                    "Usado por el servicio Liquipedia para fetch de resultados."
                ),
                max_length=255,
                null=True,
            ),
        ),
        migrations.RenameModel(
            old_name="HLTVUpdateSettings",
            new_name="MatchUpdateSettings",
        ),
        migrations.RenameField(
            model_name="matchupdatesettings",
            old_name="use_real_api",
            new_name="use_liquipedia_api",
        ),
        migrations.AlterField(
            model_name="matchupdatesettings",
            name="is_active",
            field=models.BooleanField(
                default=False,
                help_text="Activar la actualización automática de resultados de partidos desde Liquipedia.",
            ),
        ),
        migrations.AlterField(
            model_name="matchupdatesettings",
            name="use_liquipedia_api",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Cuando is_active está ON: si True, llama a Liquipedia Cargo API; "
                    "si False, el operador edita resultados manualmente en el admin."
                ),
            ),
        ),
        migrations.AlterModelOptions(
            name="matchupdatesettings",
            options={
                "verbose_name": "Match Update Settings",
                "verbose_name_plural": "Match Update Settings",
            },
        ),
    ]
