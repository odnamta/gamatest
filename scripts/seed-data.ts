/**
 * Database Seed Script for GamaTest
 *
 * Seeds two tenant organizations (GIS & GLS) with sample deck templates.
 *
 * Usage: npm run seed
 *
 * Prerequisites:
 * - Supabase project with schema.sql applied
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ============================================
// Tenant Configuration
// ============================================

interface TenantConfig {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
  decks: DeckConfig[];
}

interface DeckConfig {
  title: string;
  subject: string;
  description: string;
  cards: { stem: string; options: string[]; correct_index: number; explanation: string }[];
}

const TENANTS: TenantConfig[] = [
  {
    name: 'PT. Gama Intisamudera',
    slug: 'gis',
    ownerEmail: 'admin@gis.cekatan.com',
    ownerPassword: 'password123',
    decks: [
      {
        title: 'Heavy Equipment Safety',
        subject: 'Safety',
        description: 'Safety protocols and procedures for heavy equipment operations',
        cards: [
          {
            stem: 'Which of the following is NOT one of the 5 essential PPE items required before operating heavy equipment?',
            options: ['Hard hat', 'Safety glasses', 'Leather gloves', 'High-visibility vest'],
            correct_index: 2,
            explanation: 'The 5 essential PPE items are: hard hat, safety glasses, steel-toed boots, high-visibility vest, and hearing protection. Leather gloves may be required in some situations but are not part of the standard 5.',
          },
          {
            stem: 'The "Three Points of Contact" rule when mounting/dismounting equipment means you should maintain:',
            options: ['Three feet on the machine at all times', 'Two hands and one foot, or two feet and one hand', 'Contact with three different parts of the machine', 'Three seconds of pause before each movement'],
            correct_index: 1,
            explanation: 'The Three Points of Contact rule requires maintaining two hands and one foot, or two feet and one hand on the machine at all times while climbing.',
          },
          {
            stem: 'During a pre-operation forklift inspection, which of these should be checked FIRST?',
            options: ['Test the horn and lights', 'Walk-around visual inspection', 'Check fluid levels', 'Test the brakes'],
            correct_index: 1,
            explanation: 'A walk-around visual inspection for leaks, damage, and tire condition should always be the first step before checking mechanical systems.',
          },
        ]
      },
      {
        title: 'Logistics Operations Basics',
        subject: 'Operations',
        description: 'Fundamentals of warehouse and logistics operations',
        cards: [
          {
            stem: 'FIFO stands for:',
            options: ['First In, First Out', 'Fast Inventory, Fast Output', 'Final Inspection, First Order', 'Freight In, Freight Out'],
            correct_index: 0,
            explanation: 'FIFO = First In, First Out. Items received first should be shipped/used first to prevent expiration and ensure proper inventory rotation.',
          },
          {
            stem: 'What is a key characteristic of cross-docking compared to traditional warehousing?',
            options: ['Products are stored for extended periods', 'Products move directly from inbound to outbound with minimal storage', 'It requires more warehouse space', 'It works best for unpredictable demand'],
            correct_index: 1,
            explanation: 'Cross-docking moves products directly from inbound to outbound with minimal or no storage time (< 24 hours), reducing handling and storage costs.',
          },
          {
            stem: 'In the 5S methodology, what does "Seiton" (Set in Order) mean?',
            options: ['Remove unnecessary items', 'Organize remaining items logically', 'Clean the workspace thoroughly', 'Maintain and continuously improve'],
            correct_index: 1,
            explanation: '5S: Sort (Seiri), Set in Order (Seiton) = organize items logically, Shine (Seiso), Standardize (Seiketsu), Sustain (Shitsuke).',
          },
        ]
      },
      {
        title: 'Customer Service Skills',
        subject: 'General',
        description: 'Essential customer service and communication skills',
        cards: [
          {
            stem: 'What is the FIRST step in handling a customer complaint?',
            options: ['Offer a solution immediately', 'Listen actively without interrupting', 'Escalate to a manager', 'Document the complaint in the system'],
            correct_index: 1,
            explanation: 'The first step is to LISTEN actively without interrupting. The customer wants to feel heard before they want a solution.',
          },
          {
            stem: 'Which statement demonstrates EMPATHY rather than sympathy?',
            options: ['"I\'m sorry that happened to you"', '"That\'s too bad"', '"I understand how frustrating this must be for you"', '"We\'ll get this sorted out"'],
            correct_index: 2,
            explanation: 'Empathy means understanding and sharing the customer\'s feelings. "I understand how frustrating this must be" shows you relate to their experience, while sympathy ("I\'m sorry that happened") can feel distant.',
          },
        ]
      },
    ]
  },
  {
    name: 'PT. Gama Lintas Samudera',
    slug: 'gls',
    ownerEmail: 'admin@gls.cekatan.com',
    ownerPassword: 'password123',
    decks: [
      {
        title: 'Freight Forwarding Fundamentals',
        subject: 'Logistics',
        description: 'Core concepts in international freight forwarding',
        cards: [
          {
            stem: 'When is FCL (Full Container Load) generally more cost-effective than LCL?',
            options: ['When cargo fills less than 30% of a container', 'When cargo fills more than 60% of a container', 'When shipping perishable goods only', 'FCL is always cheaper than LCL'],
            correct_index: 1,
            explanation: 'Generally, if cargo fills >60% of a container, FCL is more cost-effective. FCL uses the entire container for one shipper with lower per-unit cost for large volumes.',
          },
          {
            stem: 'Under CIF (Cost, Insurance & Freight) Incoterms, who arranges ocean freight and insurance?',
            options: ['The buyer arranges both', 'The seller arranges both', 'The buyer arranges freight, seller arranges insurance', 'The freight forwarder arranges both'],
            correct_index: 1,
            explanation: 'Under CIF, the seller arranges and pays for freight + minimum insurance. Risk transfers when goods are on board at origin port. The buyer is responsible from destination port onwards.',
          },
          {
            stem: 'Which document serves as the title document for cargo in international sea freight?',
            options: ['Commercial Invoice', 'Packing List', 'Bill of Lading (B/L)', 'Certificate of Origin'],
            correct_index: 2,
            explanation: 'The Bill of Lading (B/L) is the title document for cargo. It serves as a receipt of goods, a contract of carriage, and a document of title.',
          },
        ]
      },
      {
        title: 'Sales Aptitude Assessment',
        subject: 'Sales',
        description: 'Key concepts and techniques for sales professionals',
        cards: [
          {
            stem: 'In the SPIN selling technique, what does the "I" stand for?',
            options: ['Interest', 'Implication', 'Investigation', 'Implementation'],
            correct_index: 1,
            explanation: 'SPIN = Situation, Problem, Implication, Need-Payoff. Implication questions explore the consequences of problems, e.g., "How do delays affect your customer relationships?"',
          },
          {
            stem: 'In BANT qualification, what does the "A" stand for?',
            options: ['Availability', 'Authority', 'Agreement', 'Assessment'],
            correct_index: 1,
            explanation: 'BANT = Budget, Authority, Need, Timeline. Authority means identifying whether the prospect has decision-making power to approve the purchase.',
          },
        ]
      },
      {
        title: 'International Trade Compliance',
        subject: 'Compliance',
        description: 'Regulatory compliance for international trade operations',
        cards: [
          {
            stem: 'The HS (Harmonized System) Code uses how many base digits recognized globally?',
            options: ['4 digits', '6 digits', '8 digits', '10 digits'],
            correct_index: 1,
            explanation: 'The HS Code uses a 6-digit base code globally. Countries add additional digits for national specificity (e.g., 10-digit in the US).',
          },
          {
            stem: 'How long should import/export records typically be maintained in a customs compliance program?',
            options: ['1 year', '3 years', '5 years', '10 years'],
            correct_index: 2,
            explanation: 'Record keeping in a customs compliance program typically requires maintaining import/export records for 5 years.',
          },
          {
            stem: 'What is the primary benefit of AEO (Authorized Economic Operator) certification?',
            options: ['Tax exemptions on all imports', 'Fewer physical inspections and priority customs processing', 'Unlimited import quotas', 'Free insurance on all shipments'],
            correct_index: 1,
            explanation: 'AEO certification provides fewer physical inspections, priority processing, reduced documentation, mutual recognition with partner countries, and faster clearance times.',
          },
        ]
      },
    ]
  },
];

// ============================================
// Seed Functions
// ============================================

async function getOrCreateUser(email: string, password: string): Promise<string> {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u: { email?: string }) => u.email === email
  );

  if (existing) {
    console.log(`   User ${email} already exists`);
    return existing.id;
  }

  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    console.error(`Failed to create user ${email}:`, error.message);
    process.exit(1);
  }

  console.log(`   Created user ${email}`);
  return newUser.user.id;
}

async function getOrCreateOrg(name: string, slug: string): Promise<string> {
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    console.log(`   Org "${name}" (${slug}) already exists`);
    return existing.id;
  }

  const settings = {
    features: {
      study_mode: true,
      assessment_mode: true,
      proctoring: false,
      ai_tagging: true,
      bulk_import: true,
      analytics: true,
      erp_integration: false,
    },
    branding: {
      primary_color: '#1e40af',
      logo_url: '',
    },
    default_language: 'id',
  };

  const { data: newOrg, error } = await supabase
    .from('organizations')
    .insert({ name, slug, settings })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create org ${name}:`, error.message);
    process.exit(1);
  }

  console.log(`   Created org "${name}" (${slug})`);
  return newOrg.id;
}

async function ensureOrgMember(orgId: string, userId: string, role: string) {
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (existing) return;

  const { error } = await supabase
    .from('organization_members')
    .insert({ org_id: orgId, user_id: userId, role });

  if (error) {
    console.error(`Failed to add member to org:`, error.message);
    process.exit(1);
  }
}

async function seedDecks(orgId: string, userId: string, decks: DeckConfig[]) {
  for (const deck of decks) {
    // Check for existing deck
    const { data: existing } = await supabase
      .from('deck_templates')
      .select('id')
      .eq('org_id', orgId)
      .eq('title', deck.title)
      .single();

    let deckId: string;

    if (existing) {
      console.log(`      Deck "${deck.title}" already exists, refreshing cards...`);
      deckId = existing.id;
      await supabase.from('card_templates').delete().eq('deck_template_id', deckId);
    } else {
      const { data: newDeck, error } = await supabase
        .from('deck_templates')
        .insert({
          title: deck.title,
          description: deck.description,
          subject: deck.subject,
          visibility: 'private',
          author_id: userId,
          org_id: orgId,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Failed to create deck "${deck.title}":`, error.message);
        continue;
      }
      deckId = newDeck.id;
    }

    // Insert card templates
    const cardsToInsert = deck.cards.map((card) => ({
      deck_template_id: deckId,
      stem: card.stem,
      options: card.options,
      correct_index: card.correct_index,
      explanation: card.explanation,
    }));

    const { error: cardsError } = await supabase
      .from('card_templates')
      .insert(cardsToInsert);

    if (cardsError) {
      console.error(`Failed to insert cards for "${deck.title}":`, cardsError.message);
      continue;
    }

    console.log(`      "${deck.title}" - ${deck.cards.length} cards`);
  }
}

// ============================================
// Main Seed
// ============================================

async function seed() {
  console.log('Starting GamaTest multi-tenant seed...\n');

  for (const tenant of TENANTS) {
    console.log(`\n== ${tenant.name} (${tenant.slug}) ==`);

    // 1. Create user
    const userId = await getOrCreateUser(tenant.ownerEmail, tenant.ownerPassword);

    // 2. Ensure profile exists
    const { data: profileExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!profileExists) {
      await supabase.from('profiles').insert({
        id: userId,
        email: tenant.ownerEmail,
        full_name: `Admin ${tenant.slug.toUpperCase()}`,
      });
    }

    // 3. Create org
    const orgId = await getOrCreateOrg(tenant.name, tenant.slug);

    // 4. Add user as owner
    await ensureOrgMember(orgId, userId, 'owner');

    // 5. Seed decks
    console.log(`   Seeding ${tenant.decks.length} decks:`);
    await seedDecks(orgId, userId, tenant.decks);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Seed completed successfully!\n');
  for (const tenant of TENANTS) {
    console.log(`${tenant.name} (${tenant.slug}):`);
    console.log(`   Email:    ${tenant.ownerEmail}`);
    console.log(`   Password: ${tenant.ownerPassword}`);
    console.log(`   Decks:    ${tenant.decks.map(d => d.title).join(', ')}`);
    console.log('');
  }
  console.log('='.repeat(50));
}

seed().catch(console.error);
