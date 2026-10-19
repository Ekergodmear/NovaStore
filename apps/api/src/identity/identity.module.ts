import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
