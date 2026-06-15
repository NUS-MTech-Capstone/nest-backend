import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AccessPolicy } from './access-policy.entity';
import { IdentityController } from './identity.controller';
import { IdentityUserService } from './identity-user.service';
import { PolicyService } from './policy.service';

@Module({
  imports: [SequelizeModule.forFeature([AccessPolicy])],
  controllers: [IdentityController],
  providers: [PolicyService, IdentityUserService],
  exports: [PolicyService],
})
export class IdentityModule {}
