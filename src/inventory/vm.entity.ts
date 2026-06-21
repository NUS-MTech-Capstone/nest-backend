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

export enum AssetStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Maintenance = 'Maintenance',
  Retired = 'Retired',
}

export interface VirtualMachineCreationAttrs {
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  tags?: string[];
}

@Table({ tableName: 'virtual_machines', timestamps: true })
export class VirtualMachine extends Model<
  VirtualMachine,
  VirtualMachineCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT, unique: true, allowNull: false })
  hostname: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  ipAddress: string;

  @Column({
    type: DataType.ENUM(...Object.values(AssetStatus)),
    defaultValue: AssetStatus.Active,
  })
  assetStatus: AssetStatus;

  @Column({ type: DataType.TEXT, allowNull: false })
  osVersion: string;

  @Default(22)
  @Column({ type: DataType.INTEGER })
  sshPort: number;

  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  tags: string[];

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
