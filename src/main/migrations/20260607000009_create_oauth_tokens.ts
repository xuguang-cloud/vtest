import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('oauth_tokens', (table) => {
    table.increments('id').primary()
    table.integer('project_id').notNullable().references('id').inTable('projects')
    table.string('provider').notNullable()
    table.text('encrypted_token').notNullable()
    table.string('iv').notNullable()
    table.string('auth_tag').notNullable()
    table.string('dek_iv').notNullable()
    table.string('state').nullable()
    table.string('code_verifier').nullable()
    table.string('code_challenge').nullable()
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('oauth_tokens')
}