import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../../generated/prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const schema = process.env.DATABASE_URL
      ? (new URL(process.env.DATABASE_URL).searchParams.get('schema') ??
        undefined)
      : undefined

    super({
      adapter: new PrismaPg(
        { connectionString: process.env.DATABASE_URL },
        { schema },
      ),
      log: ['warn', 'error'],
    })
  }

  onModuleInit() {
    return this.$connect()
  }

  onModuleDestroy() {
    return this.$disconnect()
  }
}
