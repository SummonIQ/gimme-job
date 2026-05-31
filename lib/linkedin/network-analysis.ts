"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { LinkedInConnection, LinkedInProfile, User } from "@/generated/prisma/client";

export interface NetworkNode {
  id: string;
  name: string;
  type: 'self' | 'connection' | 'potential' | 'company' | 'school';
  headline?: string;
  company?: string;
  profilePictureUrl?: string;
  profileUrl?: string;
  strength: number; // 0-100 connection strength
  cluster?: string; // For grouping related nodes
  metadata?: Record<string, any>;
}

export interface NetworkLink {
  source: string;
  target: string;
  type: 'direct' | 'mutual' | 'company' | 'school' | 'industry' | 'potential';
  strength: number; // 0-100 link strength
  metadata?: Record<string, any>;
}

export interface NetworkCluster {
  id: string;
  name: string;
  type: 'company' | 'school' | 'industry' | 'geographic' | 'skill';
  nodes: string[]; // Node IDs in this cluster
  size: number;
  avgStrength: number;
}

export interface NetworkMetrics {
  totalConnections: number;
  totalClusters: number;
  networkDensity: number; // 0-1, how interconnected the network is
  avgConnectionStrength: number;
  topConnectors: NetworkNode[]; // Most connected people
  isolatedNodes: NetworkNode[]; // Connections with few mutual connections
  growthRate: number; // Connections per month
  reachableProfiles: number; // 2nd and 3rd degree connections
}

export interface RelationshipStrength {
  connectionId: string;
  overallScore: number; // 0-100
  factors: {
    interactionFrequency: number; // How often you interact
    responseRate: number; // How often they respond
    connectionAge: number; // How long you've been connected
    mutualConnections: number; // Shared connections
    sharedExperiences: number; // Same company/school
    industryAlignment: number; // Same industry/field
    engagementLevel: number; // Views, likes, comments
  };
  recommendations: string[];
}

/**
 * Calculate relationship strength for a connection
 */
export async function calculateRelationshipStrength(
  connectionId: string
): Promise<RelationshipStrength> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  const connection = await db.linkedInConnection.findUnique({
    where: {
      id: connectionId,
      userId: user.id,
    },
    include: {
      followUps: true,
    },
  });

  if (!connection) throw new Error("Connection not found");

  // Calculate various strength factors
  const factors = {
    interactionFrequency: calculateInteractionFrequency(connection),
    responseRate: calculateResponseRate(connection),
    connectionAge: calculateConnectionAge(connection),
    mutualConnections: await calculateMutualConnections(connection, user.id),
    sharedExperiences: await calculateSharedExperiences(connection, user.id),
    industryAlignment: calculateIndustryAlignment(connection),
    engagementLevel: calculateEngagementLevel(connection),
  };

  // Calculate weighted overall score
  const weights = {
    interactionFrequency: 0.25,
    responseRate: 0.20,
    connectionAge: 0.10,
    mutualConnections: 0.15,
    sharedExperiences: 0.10,
    industryAlignment: 0.10,
    engagementLevel: 0.10,
  };

  const overallScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + (value * weights[key as keyof typeof weights]);
  }, 0);

  // Generate recommendations based on strength
  const recommendations = generateStrengthRecommendations(factors, overallScore);

  return {
    connectionId,
    overallScore: Math.round(overallScore),
    factors,
    recommendations,
  };
}

function calculateInteractionFrequency(connection: any): number {
  const followUpCount = connection.followUps?.length || 0;
  const daysSinceConnection = connection.connectionAcceptedAt
    ? (Date.now() - new Date(connection.connectionAcceptedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 365;

  const interactionsPerMonth = (followUpCount / daysSinceConnection) * 30;

  // Score based on interactions per month
  if (interactionsPerMonth >= 4) return 100;
  if (interactionsPerMonth >= 2) return 80;
  if (interactionsPerMonth >= 1) return 60;
  if (interactionsPerMonth >= 0.5) return 40;
  return 20;
}

function calculateResponseRate(connection: any): number {
  if (!connection.responseReceived) return 0;
  if (connection.responseAt && connection.connectionSentAt) {
    const responseTime = new Date(connection.responseAt).getTime() - new Date(connection.connectionSentAt).getTime();
    const responseHours = responseTime / (1000 * 60 * 60);

    if (responseHours <= 24) return 100;
    if (responseHours <= 72) return 80;
    if (responseHours <= 168) return 60; // 1 week
    return 40;
  }
  return 20;
}

function calculateConnectionAge(connection: any): number {
  if (!connection.connectionAcceptedAt) return 0;

  const ageInDays = (Date.now() - new Date(connection.connectionAcceptedAt).getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays >= 365 * 2) return 100; // 2+ years
  if (ageInDays >= 365) return 80; // 1+ year
  if (ageInDays >= 180) return 60; // 6+ months
  if (ageInDays >= 90) return 40; // 3+ months
  return 20;
}

async function calculateMutualConnections(connection: any, userId: string): Promise<number> {
  // In a real implementation, this would query LinkedIn API or stored connection data
  // For now, return a placeholder based on tags or metadata
  const hasMutualTag = connection.tags?.includes('mutual') || false;
  return hasMutualTag ? 60 : 20;
}

async function calculateSharedExperiences(connection: any, userId: string): Promise<number> {
  // Check if they worked at the same company or went to the same school
  const profile = await db.linkedInProfile.findFirst({
    where: { userId },
  });

  if (!profile || !profile.profileData) return 20;

  const profileData = profile.profileData as any;
  const userCompanies = profileData.positions?.map((p: any) => p.company?.toLowerCase()) || [];
  const userSchools = profileData.education?.map((e: any) => e.school?.toLowerCase()) || [];

  let score = 20;

  if (connection.targetCompany) {
    const targetCompany = connection.targetCompany.toLowerCase();
    if (userCompanies.includes(targetCompany)) {
      score = Math.max(score, 80);
    }
  }

  // Additional shared experience checks could go here

  return score;
}

function calculateIndustryAlignment(connection: any): number {
  // Check if they're in the same industry based on headline/company
  if (!connection.targetHeadline) return 20;

  const techKeywords = ['engineer', 'developer', 'designer', 'product', 'data', 'software'];
  const headline = connection.targetHeadline.toLowerCase();

  const hasIndustryMatch = techKeywords.some(keyword => headline.includes(keyword));
  return hasIndustryMatch ? 80 : 40;
}

function calculateEngagementLevel(connection: any): number {
  let score = 20;

  if (connection.viewedProfile) score += 20;
  if (connection.responseReceived) score += 30;
  if (connection.followUpCount > 0) score += 30;

  return Math.min(score, 100);
}

function generateStrengthRecommendations(
  factors: RelationshipStrength['factors'],
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  if (factors.interactionFrequency < 60) {
    recommendations.push("Increase engagement by sending a follow-up message or sharing relevant content");
  }

  if (factors.responseRate < 40) {
    recommendations.push("Try a different approach or message timing to improve response rate");
  }

  if (factors.mutualConnections < 50) {
    recommendations.push("Explore mutual connections to strengthen your network relationship");
  }

  if (factors.engagementLevel < 50) {
    recommendations.push("View their profile and engage with their content to build rapport");
  }

  if (overallScore > 80) {
    recommendations.push("This is a strong connection - consider asking for introductions or advice");
  }

  return recommendations;
}

/**
 * Build complete network graph for visualization
 */
export async function buildNetworkGraph(): Promise<{
  nodes: NetworkNode[];
  links: NetworkLink[];
  clusters: NetworkCluster[];
  metrics: NetworkMetrics;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  // Get user's LinkedIn profile
  const profile = await db.linkedInProfile.findFirst({
    where: { userId: user.id },
  });

  // Get all connections
  const connections = await db.linkedInConnection.findMany({
    where: {
      userId: user.id,
      status: 'ACCEPTED',
    },
  });

  // Build nodes
  const nodes: NetworkNode[] = [];

  // Add self node
  nodes.push({
    id: user.id,
    name: profile ? `${profile.firstName} ${profile.lastName}` : user.name || 'You',
    type: 'self',
    headline: profile?.headline || undefined,
    profilePictureUrl: profile?.profilePictureUrl || undefined,
    strength: 100,
    cluster: 'self',
  });

  // Add connection nodes
  const clusterMap = new Map<string, string[]>();

  for (const connection of connections) {
    const strength = await calculateRelationshipStrength(connection.id);
    const cluster = determineCluster(connection);

    nodes.push({
      id: connection.id,
      name: connection.targetName,
      type: 'connection',
      headline: connection.targetHeadline || undefined,
      company: connection.targetCompany || undefined,
      profilePictureUrl: connection.targetImageUrl || undefined,
      profileUrl: connection.targetUrl || undefined,
      strength: strength.overallScore,
      cluster,
    });

    // Track clusters
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, []);
    }
    clusterMap.get(cluster)!.push(connection.id);
  }

  // Build links
  const links: NetworkLink[] = [];

  // Add direct connections from self to each connection
  for (const connection of connections) {
    const strength = await calculateRelationshipStrength(connection.id);
    links.push({
      source: user.id,
      target: connection.id,
      type: 'direct',
      strength: strength.overallScore,
    });
  }

  // Add potential mutual connections (simplified for now)
  // In a real implementation, this would analyze actual mutual connections
  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      if (connections[i].targetCompany === connections[j].targetCompany && connections[i].targetCompany) {
        links.push({
          source: connections[i].id,
          target: connections[j].id,
          type: 'company',
          strength: 50,
        });
      }
    }
  }

  // Build clusters
  const clusters: NetworkCluster[] = Array.from(clusterMap.entries()).map(([clusterId, nodeIds]) => {
    const clusterNodes = nodes.filter(n => nodeIds.includes(n.id));
    const avgStrength = clusterNodes.reduce((sum, n) => sum + n.strength, 0) / clusterNodes.length;

    return {
      id: clusterId,
      name: clusterId.replace(/_/g, ' '),
      type: determineClusterType(clusterId),
      nodes: nodeIds,
      size: nodeIds.length,
      avgStrength,
    };
  });

  // Calculate metrics
  const metrics = calculateNetworkMetrics(nodes, links, connections);

  return { nodes, links, clusters, metrics };
}

function determineCluster(connection: any): string {
  if (connection.targetCompany) {
    return `company_${connection.targetCompany.toLowerCase().replace(/\s+/g, '_')}`;
  }
  if (connection.campaignId) {
    return `campaign_${connection.campaignId}`;
  }
  if (connection.tags?.length > 0) {
    return `tag_${connection.tags[0]}`;
  }
  return 'general';
}

function determineClusterType(clusterId: string): NetworkCluster['type'] {
  if (clusterId.startsWith('company_')) return 'company';
  if (clusterId.startsWith('school_')) return 'school';
  if (clusterId.startsWith('industry_')) return 'industry';
  if (clusterId.startsWith('geo_')) return 'geographic';
  return 'skill';
}

function calculateNetworkMetrics(
  nodes: NetworkNode[],
  links: NetworkLink[],
  connections: any[]
): NetworkMetrics {
  const connectionNodes = nodes.filter(n => n.type === 'connection');
  const totalConnections = connectionNodes.length;

  // Calculate network density (actual links / possible links)
  const possibleLinks = (totalConnections * (totalConnections - 1)) / 2;
  const actualLinks = links.filter(l => l.type !== 'direct').length;
  const networkDensity = possibleLinks > 0 ? actualLinks / possibleLinks : 0;

  // Calculate average connection strength
  const avgConnectionStrength = connectionNodes.length > 0
    ? connectionNodes.reduce((sum, n) => sum + n.strength, 0) / connectionNodes.length
    : 0;

  // Find top connectors (nodes with most links)
  const linkCounts = new Map<string, number>();
  links.forEach(link => {
    linkCounts.set(link.source, (linkCounts.get(link.source) || 0) + 1);
    linkCounts.set(link.target, (linkCounts.get(link.target) || 0) + 1);
  });

  const topConnectors = connectionNodes
    .sort((a, b) => (linkCounts.get(b.id) || 0) - (linkCounts.get(a.id) || 0))
    .slice(0, 5);

  // Find isolated nodes (few mutual connections)
  const isolatedNodes = connectionNodes
    .filter(node => (linkCounts.get(node.id) || 0) <= 1)
    .slice(0, 5);

  // Calculate growth rate (simplified - would need historical data)
  const recentConnections = connections.filter(c => {
    const acceptedAt = c.connectionAcceptedAt;
    if (!acceptedAt) return false;
    const daysSince = (Date.now() - new Date(acceptedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  });
  const growthRate = recentConnections.length;

  // Estimate reachable profiles (2nd and 3rd degree)
  // This is a rough estimate - actual implementation would query LinkedIn API
  const avgConnectionsPerPerson = 500; // Industry average
  const reachableProfiles = totalConnections * avgConnectionsPerPerson;

  return {
    totalConnections,
    totalClusters: new Set(nodes.map(n => n.cluster).filter(Boolean)).size,
    networkDensity,
    avgConnectionStrength,
    topConnectors,
    isolatedNodes,
    growthRate,
    reachableProfiles,
  };
}