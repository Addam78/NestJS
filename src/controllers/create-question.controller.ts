import { Body, Controller, Post,  UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'
import type { Request } from 'express'
import { CurrentUser } from 'src/auth/current-user-decorator'
import type { UserPayload } from 'src/auth/jwt.strategy'
import {z} from 'zod'
import { title } from 'process'
import { ZodValidationPipe } from 'src/pipes/zod-validation-pipes'
import { PrismaService } from './create-account.controller'

const createQuestionBodySchema = z.object({
  title:z.string(),
  content:z.string()
})

const bodyValidationPipe = new ZodValidationPipe(createQuestionBodySchema)

type createQuestionBodySchema = z.infer<typeof createQuestionBodySchema>





@Controller('/questions')
@UseGuards(JwtAuthGuard)
export class CreateQuestionController {
  constructor(
    private prisma : PrismaService
  ) {}

  @Post()
  async handle(
    @Body(bodyValidationPipe) body:createQuestionBodySchema, 
    @CurrentUser() user:UserPayload,) {
    
    
    const {title,content} = body
    const {sub: userId} = user

    await this.prisma.question.create({
        data:{
            authorId:userId,
            title,
            content,
            slug: this.convertToSlug(title)

        }
    })
   
  }

  private convertToSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric characters except hyphen
      .replace(/\s+/g, '-') // Replace whitespace with hyphens
  }
}
