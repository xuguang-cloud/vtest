import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('apk_info', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('app_name').notNullable()
    table.string('package_name').notNullable()
    table.string('version').notNullable()
    table.integer('version_code').notNullable()
    table.integer('min_sdk').notNullable()
    table.integer('target_sdk').notNullable()
    table.text('activities').notNullable()
    table.text('permissions').notNullable()
    table.integer('file_size').notNullable()
    table.string('md5').notNullable()
    table.string('parse_status').notNullable()
    table.string('error').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('apk_info')
}