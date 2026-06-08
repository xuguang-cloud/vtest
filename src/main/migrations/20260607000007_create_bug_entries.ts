import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bug_entries', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('bug_id').notNullable().unique()
    table.string('type').notNullable()
    table.string('severity').notNullable()
    table.text('description').notNullable()
    table.string('screenshot_evidence').nullable()
    table.text('repro_steps').notNullable()
    table.string('prd_reference').nullable()
    table.string('path_id').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bug_entries')
}