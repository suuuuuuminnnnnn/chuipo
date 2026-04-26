import { Injectable } from '@nestjs/common';
import { scoringConfig, ScoringRule } from '../config/scoring.config';

export type Classification = 'backend' | 'review' | 'reject';

export interface ScoreResult {
  totalScore: number;
  classification: Classification;
  matchedKeywords: { keyword: string; score: number }[];
}

export interface JobInput {
  position: string;
  detail_intro?: string;
  detail_main_tasks?: string;
  detail_requirements?: string;
  detail_preferred?: string;
  skill_tags?: string[];
}

@Injectable()
export class ScorerService {
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private matchRules(text: string, rules: ScoringRule[]): { keyword: string; score: number }[] {
    const matches: { keyword: string; score: number }[] = [];
    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        const escaped = this.escapeRegex(keyword);
        // ASCII-only keywords use word boundaries to avoid false positives (e.g. "go" in "google")
        // Non-ASCII (Korean) keywords use substring match since \b doesn't work with Unicode
        const pattern = /^[\x00-\x7F]+$/.test(keyword)
          ? new RegExp(`\\b${escaped}\\b`, 'i')
          : new RegExp(escaped, 'i');
        if (pattern.test(text)) {
          matches.push({ keyword, score: rule.score });
          break;
        }
      }
    }
    return matches;
  }

  score(job: JobInput): ScoreResult {
    const bodyText = [
      job.detail_main_tasks,
      job.detail_requirements,
      job.detail_preferred,
      ...(job.skill_tags || []),
    ]
      .filter(Boolean)
      .join(' ');

    const introText = job.detail_intro || '';
    const isNeutralTitle = scoringConfig.neutral.some((n) =>
      job.position.toLowerCase().includes(n.toLowerCase()),
    );
    const searchText = isNeutralTitle
      ? `${bodyText} ${introText}`
      : `${bodyText} ${introText} ${job.position}`;

    const backendMatches = this.matchRules(searchText, scoringConfig.backendPositive);
    const frontendMatches = this.matchRules(searchText, scoringConfig.frontendNegative);
    const allMatches = [...backendMatches, ...frontendMatches];

    const totalScore = allMatches.reduce((sum, m) => sum + m.score, 0);

    return {
      totalScore,
      classification: this.classify(totalScore),
      matchedKeywords: allMatches,
    };
  }

  scoreForUser(
    job: JobInput,
    userKeywords?: { include: string; exclude: string },
  ): ScoreResult {
    const result = this.score(job);

    if (!userKeywords) return result;

    const bodyText = [job.position, job.detail_main_tasks, job.detail_requirements, job.detail_preferred]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (userKeywords.exclude) {
      for (const kw of userKeywords.exclude.split(',').map((k) => k.trim()).filter(Boolean)) {
        if (bodyText.includes(kw.toLowerCase())) {
          return { ...result, totalScore: -999, classification: 'reject' };
        }
      }
    }

    if (userKeywords.include) {
      for (const kw of userKeywords.include.split(',').map((k) => k.trim()).filter(Boolean)) {
        if (bodyText.includes(kw.toLowerCase())) {
          result.totalScore += 2;
          result.matchedKeywords.push({ keyword: kw, score: 2 });
        }
      }
    }

    result.classification = this.classify(result.totalScore);
    return result;
  }

  private classify(score: number): Classification {
    if (score >= scoringConfig.thresholdHigh) return 'backend';
    if (score <= scoringConfig.thresholdLow) return 'reject';
    return 'review';
  }
}
