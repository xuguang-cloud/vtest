import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('exploration_paths', (table) => {
    table.increments('id').primary()
    table.integer('test_run_id').notNullable().references('id').inTable('test_runs')
    table.string('path_id').notNullable()
    table.string('start_activity').notNullable()
    table.string('end_activity').notNullable()
    table.text('steps').notNullable()
    table.text('coverage').notNullable()
    table.boolean('reproducible').notNullable().defaultTo(true)
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('exploration_paths')
}