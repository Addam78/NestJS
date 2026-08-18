import { Module } from "@nestjs/common";
import { Http2ServerRequest } from "http2";
import { CreateAccountController, PrismaService } from "./controllers/create-account.controller";
import { AuthenticateController } from "./controllers/authenticate-controller";
import { CreateQuestionController } from "./controllers/create-question.controller";
import { FetchRecentQuestionsControl } from "./controllers/fetch-recent-questions.controller";
import { DatabaseModule } from "../database/database.module";

@Module({
    imports:[
        DatabaseModule
    ],

    exports:[PrismaService],
    
     controllers: [
    CreateAccountController,
    AuthenticateController,
    CreateQuestionController,
    FetchRecentQuestionsControl,
  ],
  providers:[
    PrismaService
  ]
})
export class HttpModule{}