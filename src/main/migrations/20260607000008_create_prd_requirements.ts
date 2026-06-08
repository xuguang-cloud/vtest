import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('prd_requirements', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('feature_id').notNullable()
    table.string('title').notNullable()
    table.string('priority').notNullable()
    table.text('acceptance_criteria').notNullable()
    table.text('ui_requirements').nullable()
    table.text('screens').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('prd_requirements')
}