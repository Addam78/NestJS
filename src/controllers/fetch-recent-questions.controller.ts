import { Body, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'
import type { Request } from 'express'
import { CurrentUser } from 'src/auth/current-user-decorator'
import type { UserPayload } from 'src/auth/jwt.strategy'
import {z} from 'zod'
import { title } from 'process'
import { ZodValidationPipe } from 'src/pipes/zod-validation-pipes'
import { PrismaService } from './create-account.controller'

const pageQueryParamSchema = z.string().optional().default('1').transform(Number).pipe(
    z.number().min(1)
)



const queryValidationPipe = new ZodValidationPipe(pageQueryParamSchema)

type PageQueryParamSchema = z.infer<typeof pageQueryParamSchema>

@Controller('/questions')
@UseGuards(JwtAuthGuard)
export class FetchRecentQuestionsControl {
  constructor(
    private prisma : PrismaService
  ) {}

  @Get()
  async handle(@Query('page',queryValidationPipe) page:PageQueryParamSchema){
    const perPage = 20
    const questions = await this.prisma.question.findMany({
        take:perPage,
        skip:(page -1) *perPage,
        orderBy:{
            createdAt:'desc'
        }
    })

    return{questions}
  }
}
