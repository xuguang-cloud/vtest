import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('test_runs', (table) => {
    table.increments('id').primary()
    table.string('uuid').notNullable().unique()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('status').notNullable().defaultTo('pending')
    table.string('exploration_id').nullable()
    table.timestamps(true, true)
  })

  await knex.schema.createTable('exploration_checkpoints', (table) => {
    table.increments('id').primary()
    table.integer('test_run_id').notNullable().references('id').inTable('test_runs')
    table.integer('step_index').notNullable()
    table.string('activity_name').notNullable()
    table.string('ui_tree_hash').notNullable()
    table.binary('state_data').notNullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('exploration_checkpoints')
  await knex.schema.dropTableIfExists('test_runs')
}