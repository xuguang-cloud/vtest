import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('screenshots', (table) => {
    table.increments('id').primary()
    table.integer('execution_result_id').notNullable().references('id').inTable('execution_results')
    table.integer('step_number').notNullable()
    table.string('file_path').notNullable()
    table.string('activity_name').nullable()
    table.string('ui_tree_hash').nullable()
    table.timestamps(true, true)
  })

  await knex.schema.createTable('reports', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.integer('test_run_id').notNullable().references('id').inTable('test_runs')
    table.string('format').notNullable().defaultTo('html')
    table.string('file_path').notNullable()
    table.integer('total_cases').notNullable()
    table.integer('passed_cases').notNullable()
    table.integer('failed_cases').notNullable()
    table.integer('blocked_cases').notNullable()
    table.float('pass_rate').notNullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reports')
  await knex.schema.dropTableIfExists('screenshots')
}