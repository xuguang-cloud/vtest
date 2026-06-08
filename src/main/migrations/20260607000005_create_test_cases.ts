import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('test_cases', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('case_id').notNullable()
    table.string('title').notNullable()
    table.string('priority').notNullable().defaultTo('P1')
    table.text('preconditions').nullable()
    table.text('steps').notNullable()
    table.text('expected_result').notNullable()
    table.text('postconditions').nullable()
    table.text('tags').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('test_cases')
}