import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InventoryChangeRequestController } from './inventory-change-request.controller';
import { InventoryChangeRequestService } from './inventory-change-request.service';
import { InventoryChangeRequest } from './inventory-change-request.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ServerInventoryController } from './server-inventory.controller';
import { VirtualMachine } from './vm.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([VirtualMachine, InventoryChangeRequest]),
  ],
  controllers: [
    InventoryController,
    InventoryChangeRequestController,
    ServerInventoryController,
  ],
  providers: [InventoryService, InventoryChangeRequestService],
})
export class InventoryModule {}
