import { Module } from '@nestjs/common';
import { AdminDevelopersController } from './admin-developers.controller';
import { AdminDevelopersService } from './admin-developers.service';
import { DeveloperAccessService } from './developer-access.service';
import { DeveloperAccountsController } from './developer-accounts.controller';
import { DeveloperGuard } from './developer.guard';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';

/** Phase 2B+ import module này và dùng DeveloperAccessService / @RequireDeveloper. */
@Module({
  controllers: [DevelopersController, DeveloperAccountsController, AdminDevelopersController],
  providers: [DeveloperAccessService, DeveloperGuard, DevelopersService, AdminDevelopersService],
  exports: [DeveloperAccessService, DeveloperGuard],
})
export class DevelopersModule {}
