import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

export interface AccessPolicyCreationAttrs {
  role: string;
  permissions: string[];
}

@Table({ tableName: 'access_policies', timestamps: true })
export class AccessPolicy extends Model<AccessPolicy, AccessPolicyCreationAttrs> {
  @PrimaryKey
  @Column({ type: DataType.TEXT })
  declare role: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  permissions: string[];

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
