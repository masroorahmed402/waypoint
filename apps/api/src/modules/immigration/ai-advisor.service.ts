import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app.config';

const MODEL = 'llama-3.1-70b-versatile';

@Injectable()
export class AiAdvisorService {
  private client: OpenAI | null = null;

  constructor(private prisma: PrismaService, private config: AppConfig) {
    if (config.groqApiKey) {
      this.client = new OpenAI({
        apiKey: config.groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  async ask(userId: string, question: string, conversationHistory: { role: string; content: string }[] = []) {
    if (!this.client) {
      return {
        answer: 'AI advisor is not configured yet. Please direct your immigration questions to your DSO directly.',
        disclaimer: 'This feature requires configuration.',
        usedAi: false,
      };
    }

    // Fetch full user context
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { university: true } },
        deadlines: {
          where: { dismissedAt: null, dueDate: { gte: new Date() } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        cptOptRecords: { orderBy: { startDate: 'desc' }, take: 5 },
      },
    });

    const profile = user?.profile;
    const deadlinesList = user?.deadlines.map((d) => `${d.title}: ${d.dueDate.toLocaleDateString()}`).join(', ') || 'none';

    const now = new Date();
    const cptOptList = user?.cptOptRecords.length
      ? user.cptOptRecords
          .map((r) => {
            const active = r.startDate <= now && r.endDate >= now;
            return `${r.type}${r.employerName ? ` at ${r.employerName}` : ''} (${r.startDate.toLocaleDateString()}–${r.endDate.toLocaleDateString()}${active ? ', ACTIVE' : ''})`;
          })
          .join(', ')
      : 'none on record';

    const programEndDate = profile?.programEndDate?.toLocaleDateString() || 'unknown';
    const programStartDate = profile?.programStartDate?.toLocaleDateString() || 'unknown';
    const university = profile?.university?.name || profile?.universityName || 'unknown';

    const systemPrompt = `You are Waypoint's immigration advisor for F-1 international students in the US.
You have access to this student's actual immigration data. Use it to give specific, personalized answers.
Be concise, warm, and helpful. Use plain English. Never use legal jargon.
Never give definitive legal advice — always recommend confirming important decisions with their DSO.
Keep responses under 150 words unless the question requires more detail.

Student profile:
- Name: ${user?.firstName} ${user?.lastName}
- University: ${university}
- Major: ${profile?.major || 'unknown'}
- Visa: ${profile?.visaType || 'F1'}
- Program: ${programStartDate} to ${programEndDate}
- STEM eligible: ${profile?.stemEligible ? 'Yes (eligible for 24-month STEM OPT extension)' : 'No'}
- CPT/OPT history: ${cptOptList}
- Upcoming deadlines: ${deadlinesList}

Always end immigration-related answers with: "Confirm this with your DSO before taking action."`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-6).map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: question },
    ];

    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 400,
      messages,
    });

    const answer = response.choices[0].message.content ?? '';

    return {
      answer,
      disclaimer: 'Not legal advice — always confirm with your DSO.',
      usedAi: true,
    };
  }

  async draftDsoEmail(userId: string, purpose: string, context?: string) {
    if (!this.client) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { university: true } } },
    });

    const profile = user?.profile;
    const purposes: Record<string, string> = {
      opt_request: 'requesting OPT authorization',
      cpt_request: 'requesting CPT authorization',
      extension_request: 'requesting a program extension',
      general_question: 'asking a general immigration question',
    };

    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Write a professional email from an F-1 student to their DSO.
Purpose: ${purposes[purpose] || purpose}
Student: ${user?.firstName} ${user?.lastName}
SEVIS ID: [student should fill in]
University: ${profile?.university?.name || profile?.universityName}
Major: ${profile?.major}
Program end: ${profile?.programEndDate?.toLocaleDateString()}
Additional context: ${context || 'none'}

Write subject line and email body. Be professional and concise. Include placeholders for any info the student needs to fill in.`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '';
    const lines = text.split('\n');
    const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'))?.replace(/^subject:\s*/i, '') || 'Request from F-1 Student';
    const body = lines.filter((l) => !l.toLowerCase().startsWith('subject:')).join('\n').trim();

    return { subject: subjectLine, body };
  }
}
