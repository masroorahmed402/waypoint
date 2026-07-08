import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, CreateReplyDto } from './dto/community.dto';
import { DocumentStatus, DocumentType } from '@prisma/client';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  private async isVerifiedF1(userId: string): Promise<boolean> {
    const doc = await this.prisma.document.findFirst({
      where: { userId, type: DocumentType.I20, status: DocumentStatus.ACTIVE },
      select: { id: true },
    });
    return !!doc;
  }

  private authorLabel(isAnonymous: boolean, firstName: string, university: string | null): string {
    if (isAnonymous) return university ? `F-1 Student at ${university}` : 'F-1 Student';
    return firstName;
  }

  async listPosts(category: string | undefined, cursor: string | undefined, sort: string | undefined, limit = 20) {
    const take = Math.min(limit, 50);
    const orderBy = sort === 'top' ? [{ upvotes: 'desc' as const }, { createdAt: 'desc' as const }] : [{ createdAt: 'desc' as const }];

    const rows = await this.prisma.communityPost.findMany({
      where: { deletedAt: null, ...(category && category !== 'all' ? { category } : {}) },
      orderBy,
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, firstName: true } },
        _count: { select: { replies: true } },
      },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const verified = await Promise.all(page.map((p) => this.isVerifiedF1(p.userId)));

    return {
      data: page.map((p, i) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        category: p.category,
        university: p.university,
        upvotes: p.upvotes,
        replyCount: p._count.replies,
        isAnonymous: p.isAnonymous,
        author: this.authorLabel(p.isAnonymous, p.user.firstName, p.university),
        verifiedF1: verified[i],
        createdAt: p.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getPost(id: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true } },
        replies: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, firstName: true } } } },
      },
    });
    if (!post) throw new NotFoundException();

    const verified = await this.isVerifiedF1(post.userId);
    const repliesVerified = await Promise.all(post.replies.map((r) => this.isVerifiedF1(r.userId)));

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      university: post.university,
      upvotes: post.upvotes,
      isAnonymous: post.isAnonymous,
      author: this.authorLabel(post.isAnonymous, post.user.firstName, post.university),
      verifiedF1: verified,
      createdAt: post.createdAt,
      replies: post.replies.map((r, i) => ({
        id: r.id,
        content: r.content,
        upvotes: r.upvotes,
        isAnonymous: r.isAnonymous,
        author: this.authorLabel(r.isAnonymous, r.user.firstName, post.university),
        verifiedF1: repliesVerified[i],
        createdAt: r.createdAt,
      })),
    };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { university: { select: { name: true } } },
    });
    const university = profile?.university?.name ?? profile?.universityName ?? null;

    return this.prisma.communityPost.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        university,
        isAnonymous: dto.isAnonymous ?? true,
      },
    });
  }

  async createReply(userId: string, postId: string, dto: CreateReplyDto) {
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException();

    return this.prisma.communityReply.create({
      data: {
        postId,
        userId,
        content: dto.content,
        isAnonymous: dto.isAnonymous ?? true,
      },
    });
  }

  async upvotePost(id: string) {
    const post = await this.prisma.communityPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException();
    return this.prisma.communityPost.update({ where: { id }, data: { upvotes: { increment: 1 } } });
  }

  async removePost(userId: string, id: string) {
    const post = await this.prisma.communityPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException();
    if (post.userId !== userId) throw new ForbiddenException('You can only delete your own posts');
    await this.prisma.communityPost.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
