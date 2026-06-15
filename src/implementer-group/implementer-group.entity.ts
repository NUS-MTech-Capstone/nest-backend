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

export interface ImplementerGroupCreationAttrs {
  name: string;
  description?: string;
  osUsers: string[];
  vmIds?: string[];
}

@Table({ tableName: 'implementer_groups', timestamps: true })
export class ImplementerGroup extends Model<
  ImplementerGroup,
  ImplementerGroupCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT, unique: true })
  name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description?: string;

  /** Dedicated OS (SSH) users assigned to this implementer group. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  osUsers: string[];

  /** Inventory VMs this group may access by default. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  vmIds: string[];

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
