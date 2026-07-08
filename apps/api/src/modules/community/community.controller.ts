import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CreatePostDto, CreateReplyDto } from './dto/community.dto';

@Controller('community')
export class CommunityController {
  constructor(private svc: CommunityService) {}

  @Get('posts')
  list(@Query('category') category?: string, @Query('cursor') cursor?: string, @Query('sort') sort?: string) {
    return this.svc.listPosts(category, cursor, sort);
  }

  @Get('posts/:id')
  get(@Param('id') id: string) {
    return this.svc.getPost(id);
  }

  @Post('posts')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreatePostDto) {
    return this.svc.createPost(u.sub, dto);
  }

  @Post('posts/:id/replies')
  reply(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CreateReplyDto) {
    return this.svc.createReply(u.sub, id, dto);
  }

  @Post('posts/:id/upvote')
  upvote(@Param('id') id: string) {
    return this.svc.upvotePost(id);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    await this.svc.removePost(u.sub, id);
  }
}
