import { prisma } from '../../shared/database/prisma';
import type { Event, EventImage } from '../../shared/entities';

export type EventWithImages = Event & { images: EventImage[] };

export interface IEventRepository {
  listPublic(): Promise<EventWithImages[]>;
  listAdmin(): Promise<EventWithImages[]>;
  findById(id: string): Promise<EventWithImages | null>;
  findBySlug(slug: string): Promise<EventWithImages | null>;
  create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventWithImages>;
  update(id: string, data: Partial<Event>): Promise<EventWithImages>;
  delete(id: string): Promise<void>;
  addImage(eventId: string, data: Omit<EventImage, 'id' | 'createdAt' | 'eventId'>): Promise<EventImage>;
  deleteImage(imageId: string): Promise<EventImage>;
}

const WITH_IMAGES = { images: { orderBy: { order: 'asc' as const } } };

export class EventRepository implements IEventRepository {
  async listPublic(): Promise<EventWithImages[]> {
    return prisma.event.findMany({
      where: { isActive: true },
      include: WITH_IMAGES,
      orderBy: { startsAt: 'desc' },
    }) as Promise<EventWithImages[]>;
  }

  async listAdmin(): Promise<EventWithImages[]> {
    return prisma.event.findMany({
      include: WITH_IMAGES,
      orderBy: { startsAt: 'desc' },
    }) as Promise<EventWithImages[]>;
  }

  async findById(id: string): Promise<EventWithImages | null> {
    return prisma.event.findUnique({ where: { id }, include: WITH_IMAGES }) as Promise<EventWithImages | null>;
  }

  async findBySlug(slug: string): Promise<EventWithImages | null> {
    return prisma.event.findUnique({ where: { slug }, include: WITH_IMAGES }) as Promise<EventWithImages | null>;
  }

  async create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventWithImages> {
    return prisma.event.create({ data, include: WITH_IMAGES }) as Promise<EventWithImages>;
  }

  async update(id: string, data: Partial<Event>): Promise<EventWithImages> {
    return prisma.event.update({ where: { id }, data, include: WITH_IMAGES }) as Promise<EventWithImages>;
  }

  async delete(id: string): Promise<void> {
    await prisma.event.delete({ where: { id } });
  }

  async addImage(eventId: string, data: Omit<EventImage, 'id' | 'createdAt' | 'eventId'>): Promise<EventImage> {
    return prisma.eventImage.create({ data: { ...data, eventId } }) as Promise<EventImage>;
  }

  async deleteImage(imageId: string): Promise<EventImage> {
    return prisma.eventImage.delete({ where: { id: imageId } }) as Promise<EventImage>;
  }
}