import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { error } from 'console'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'


const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})



function generateUniqueDatabaseUrl(schemaId: string) {

    if (!process.env.DATABASE_URL) {
        throw new error('Please provider de env URL')
    }
    const url = new URL(process.env.DATABASE_URL)

    url.searchParams.set('schema',schemaId)

    return url.toString()
}

const schemaId = randomUUID()

beforeAll(async () =>{
    const databaseURL = generateUniqueDatabaseUrl(schemaId)
    process.env.DATABASE_URL = databaseURL
    console.log(databaseURL)
    
    //COMANDO PARA RODAR MIGRATIONS
    execSync('yarn prisma migrate deploy')
})

afterAll(async() =>{
   await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaId}" CASCADE`)
  await prisma.$disconnect()
})