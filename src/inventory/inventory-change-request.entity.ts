import {
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { AssetStatus } from './vm.entity';

export enum InventoryChangeAction {
  Add = 'Add',
  Update = 'Update',
}

export enum InventoryChangeStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface ApprovalHistoryItem {
  when: string;
  actor: string;
  action: string;
  note: string;
}

export interface InventoryChangeRequestCreationAttrs {
  action: InventoryChangeAction;
  requester: string;
  targetVmId?: string;
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  comments?: string;
  status?: InventoryChangeStatus;
  history: ApprovalHistoryItem[];
  approver?: string;
}

@Table({ tableName: 'inventory_change_requests', timestamps: true })
export class InventoryChangeRequest extends Model<
  InventoryChangeRequest,
  InventoryChangeRequestCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({
    type: DataType.ENUM(...Object.values(InventoryChangeAction)),
  })
  action: InventoryChangeAction;

  @Column({
    type: DataType.ENUM(...Object.values(InventoryChangeStatus)),
    defaultValue: InventoryChangeStatus.Pending,
  })
  status: InventoryChangeStatus;

  @Column({ type: DataType.TEXT })
  requester: string;

  @Column({ type: DataType.UUID, allowNull: true })
  targetVmId?: string;

  @Column({ type: DataType.TEXT })
  hostname: string;

  @Column({ type: DataType.TEXT })
  ipAddress: string;

  @Column({
    type: DataType.ENUM(...Object.values(AssetStatus)),
    defaultValue: AssetStatus.Active,
  })
  assetStatus: AssetStatus;

  @Column({ type: DataType.TEXT })
  osVersion: string;

  @Default(22)
  @Column({ type: DataType.INTEGER })
  sshPort: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  comments?: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  approver?: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  history: ApprovalHistoryItem[];

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
