import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('execution_results', (table) => {
    table.increments('id').primary()
    table.integer('test_run_id').notNullable().references('id').inTable('test_runs')
    table.string('case_id').notNullable()
    table.string('status').notNullable()
    table.integer('duration').notNullable()
    table.text('step_results').notNullable()
    table.string('logs_path').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('execution_results')
}