"""Add manual world ranking fields to Team.

- Team.world_ranking            : PositiveIntegerField, nullable
- Team.world_ranking_updated_at : DateTimeField, nullable, set by admin save_model

Both fields are operator-managed; no auto-sync from external sources in this PR.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0008_liquipedia_service"),
    ]

    operations = [
        migrations.AddField(
            model_name="team",
            name="world_ranking",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Ranking mundial del equipo (1 = mejor). Lo actualiza el operador a mano desde el admin.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="team",
            name="world_ranking_updated_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Última vez que el operador actualizó world_ranking. Se rellena automáticamente al guardar desde el admin.",
                null=True,
            ),
        ),
    ]
