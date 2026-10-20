import { Module } from '@nestjs/common';
import { DevelopersModule } from '../developers/developers.module';
import { AdminCategoriesController, CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { DeveloperAppsController } from './developer-apps.controller';
import { DeveloperAppsService } from './developer-apps.service';

@Module({
  imports: [DevelopersModule],
  controllers: [DeveloperAppsController, CategoriesController, AdminCategoriesController],
  providers: [DeveloperAppsService, CategoriesService],
})
export class AppsModule {}
