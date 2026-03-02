import { PrismaClient, RuleType } from '@prisma/client';
import { KlaviyoClient } from './klaviyo-client';
import { withAccountContext } from '../utils/rls';

interface CleanupRule {
  type: RuleType;
  pattern: string;
}

interface ProfileAttributes {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface ScanResult {
  email: string;
  profileId: string;
  matchedRule: string;
}

export class ProfileScanner {
  private klaviyoClient: KlaviyoClient;
  private prisma: PrismaClient;

  constructor(klaviyoClient: KlaviyoClient, prisma: PrismaClient) {
    this.klaviyoClient = klaviyoClient;
    this.prisma = prisma;
  }

  // Build full name from first_name + last_name for matching
  private getFullName(attrs: ProfileAttributes): string {
    const first = (attrs.first_name ?? '').trim();
    const last = (attrs.last_name ?? '').trim();
    return [first, last].filter(Boolean).join(' ').toLowerCase();
  }

  // Check if profile matches any rule (email and optional name attributes)
  matchesRule(
    email: string,
    rules: CleanupRule[],
    profileAttrs?: ProfileAttributes
  ): CleanupRule | null {
    const emailLower = email.toLowerCase();

    for (const rule of rules) {
      const patternLower = rule.pattern.toLowerCase();

      switch (rule.type) {
        case 'PREFIX':
          if (emailLower.startsWith(patternLower)) return rule;
          break;
        case 'SUFFIX':
          if (emailLower.endsWith(patternLower)) return rule;
          break;
        case 'DOMAIN': {
          const domain = emailLower.split('@')[1];
          if (domain === patternLower || domain?.endsWith(`.${patternLower}`)) return rule;
          break;
        }
        case 'CONTAINS':
          if (emailLower.includes(patternLower)) return rule;
          break;
        case 'NAME_CONTAINS':
          if (profileAttrs) {
            const fullName = this.getFullName(profileAttrs);
            if (fullName && fullName.includes(patternLower)) return rule;
          }
          break;
      }
    }

    return null;
  }

  // Scan profiles and return matches (preview mode)
  async scanProfiles(accountId: string): Promise<ScanResult[]> {
    // Fetch active rules for this account with RLS context
    const rules = await withAccountContext(this.prisma, accountId, async () => {
      return await this.prisma.cleanupRule.findMany({
        where: { accountId, isActive: true },
      });
    });

    if (rules.length === 0) {
      return [];
    }

    // Fetch all profiles
    const profiles = await this.klaviyoClient.getAllProfiles();
    const matches: ScanResult[] = [];

    for (const profile of profiles) {
      const email = profile.attributes?.email;
      if (!email) continue;

      const attrs: ProfileAttributes = {
        email: profile.attributes?.email,
        first_name: profile.attributes?.first_name ?? null,
        last_name: profile.attributes?.last_name ?? null,
      };
      const matchedRule = this.matchesRule(email, rules, attrs);
      if (matchedRule) {
        matches.push({
          email,
          profileId: profile.id,
          matchedRule: `${matchedRule.type}: ${matchedRule.pattern}`,
        });
      }
    }

    return matches;
  }

  // Delete matching profiles
  async deleteMatchingProfiles(
    accountId: string,
    profilesToDelete: ScanResult[]
  ): Promise<{ deleted: number; failed: number; errors: string[] }> {
    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Rate limit: 3/s burst, 60/m steady for deletion endpoint
    const DELAY_BETWEEN_DELETIONS = 1100; // ~55 per minute to stay safe

    for (const profile of profilesToDelete) {
      const result = await this.klaviyoClient.deleteProfile(profile.email);
      
      if (result.success) {
        results.deleted++;
        
        // Log the deletion with RLS context
        await withAccountContext(this.prisma, accountId, async () => {
          await this.prisma.deletionLog.create({
            data: {
              accountId,
              profileEmail: profile.email,
              profileId: profile.profileId,
              ruleMatched: profile.matchedRule,
            },
          });
        });
      } else {
        results.failed++;
        results.errors.push(`${profile.email}: ${result.error}`);
      }

      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DELETIONS));
    }

    return results;
  }
}

