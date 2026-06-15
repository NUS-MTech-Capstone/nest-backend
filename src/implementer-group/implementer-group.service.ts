import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateImplementerGroupDto } from './dto/create-implementer-group.dto';
import { UpdateImplementerGroupDto } from './dto/update-implementer-group.dto';
import { ImplementerGroup } from './implementer-group.entity';

@Injectable()
export class ImplementerGroupService {
  constructor(
    @InjectModel(ImplementerGroup)
    private implementerGroupModel: typeof ImplementerGroup,
  ) {}

  findAll(): Promise<ImplementerGroup[]> {
    return this.implementerGroupModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  findByIds(ids: string[]): Promise<ImplementerGroup[]> {
    if (!ids.length) {
      return Promise.resolve([]);
    }
    return this.implementerGroupModel.findAll({ where: { id: ids } });
  }

  findOne(id: string): Promise<ImplementerGroup | null> {
    return this.implementerGroupModel.findByPk(id);
  }

  async create(dto: CreateImplementerGroupDto): Promise<ImplementerGroup> {
    const existing = await this.implementerGroupModel.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Implementer group "${dto.name}" already exists`,
      );
    }
    return this.implementerGroupModel.create({
      name: dto.name,
      description: dto.description,
      osUsers: dto.osUsers ?? [],
      vmIds: dto.vmIds ?? [],
    });
  }

  async update(
    id: string,
    dto: UpdateImplementerGroupDto,
  ): Promise<ImplementerGroup | undefined> {
    const group = await this.findOne(id);
    if (!group) {
      return undefined;
    }
    if (dto.name && dto.name !== group.name) {
      const existing = await this.implementerGroupModel.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException(
          `Implementer group "${dto.name}" already exists`,
        );
      }
      group.name = dto.name;
    }
    if (dto.description !== undefined) {
      group.description = dto.description;
    }
    if (dto.osUsers !== undefined) {
      group.osUsers = dto.osUsers;
    }
    if (dto.vmIds !== undefined) {
      group.vmIds = dto.vmIds;
    }
    return group.save();
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.implementerGroupModel.destroy({ where: { id } });
    return deleted > 0;
  }
}
