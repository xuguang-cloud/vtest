import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary()
    table.string('uuid').notNullable().unique()
    table.string('name').notNullable()
    table.text('description').nullable()
    table.string('apk_path').nullable()
    table.string('prd_path').nullable()
    table.string('design_path').nullable()
    table.string('status').notNullable().defaultTo('active')
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects')
}