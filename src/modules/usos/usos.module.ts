import { Module } from '@nestjs/common';
import { UsosController } from './usos.controller';
import { UsosService } from './usos.service';

@Module({
  controllers: [UsosController],
  providers: [UsosService],
  exports: [UsosService],
})
export class UsosModule {}
