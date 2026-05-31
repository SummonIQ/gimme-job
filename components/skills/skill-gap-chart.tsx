'use client';

import React from 'react';
import { 
  Bar, 
  BarChart, 
  Cell, 
  Legend, 
  Pie, 
  PieChart, 
  RadarChart, 
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skill } from '@/lib/skills/gap-analysis';

interface SkillGapChartProps {
  matchedSkills: Skill[];
  missingSkills: Skill[];
  partialSkills: Skill[];
  overallMatch: number;
}

const COLORS = {
  matched: '#22c55e', // green
  partial: '#f59e0b', // amber
  missing: '#ef4444', // red
};

export function SkillGapChart({
  matchedSkills,
  missingSkills,
  partialSkills,
  overallMatch
}: SkillGapChartProps) {
  // Prepare data for pie chart
  const pieData = [
    { name: 'Matched Skills', value: matchedSkills.length, color: COLORS.matched },
    { name: 'Partially Matched', value: partialSkills.length, color: COLORS.partial },
    { name: 'Missing Skills', value: missingSkills.length, color: COLORS.missing },
  ];
  
  // Prepare data for bar chart - top skills by relevance
  const allSkills = [
    ...matchedSkills.map(s => ({ ...s, status: 'matched' })),
    ...partialSkills.map(s => ({ ...s, status: 'partial' })),
    ...missingSkills.map(s => ({ ...s, status: 'missing' })),
  ]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);
  
  // Prepare data for radar chart - by skill type
  const skillsByType = {
    technical: { matched: 0, partial: 0, missing: 0 },
    soft: { matched: 0, partial: 0, missing: 0 },
    domain: { matched: 0, partial: 0, missing: 0 },
  };
  
  matchedSkills.forEach(s => {
    skillsByType[s.type].matched++;
  });
  
  partialSkills.forEach(s => {
    skillsByType[s.type].partial++;
  });
  
  missingSkills.forEach(s => {
    skillsByType[s.type].missing++;
  });
  
  const radarData = [
    {
      subject: 'Technical Skills',
      matched: skillsByType.technical.matched,
      partial: skillsByType.technical.partial,
      missing: skillsByType.technical.missing,
      fullMark: Math.max(
        skillsByType.technical.matched + 
        skillsByType.technical.partial + 
        skillsByType.technical.missing,
        5
      ),
    },
    {
      subject: 'Soft Skills',
      matched: skillsByType.soft.matched,
      partial: skillsByType.soft.partial,
      missing: skillsByType.soft.missing,
      fullMark: Math.max(
        skillsByType.soft.matched + 
        skillsByType.soft.partial + 
        skillsByType.soft.missing,
        5
      ),
    },
    {
      subject: 'Domain Knowledge',
      matched: skillsByType.domain.matched,
      partial: skillsByType.domain.partial,
      missing: skillsByType.domain.missing,
      fullMark: Math.max(
        skillsByType.domain.matched + 
        skillsByType.domain.partial + 
        skillsByType.domain.missing,
        5
      ),
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Overall Match Indicator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Overall Match</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <div className="relative h-36 w-36 flex items-center justify-center">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle
                  className="stroke-slate-200"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  className="stroke-primary transition-all"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${overallMatch * 2.51} 251`}
                  strokeDashoffset="0"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute font-bold text-2xl">{overallMatch}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Skill Analysis Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Skills Analysis</CardTitle>
          <CardDescription>Breakdown of your skill match for this job</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="distribution">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="relevance">By Relevance</TabsTrigger>
              <TabsTrigger value="types">Skill Types</TabsTrigger>
            </TabsList>
            
            <TabsContent value="distribution" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="relevance" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allSkills}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                >
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `Relevance: ${value}`,
                      props.payload.name
                    ]}
                  />
                  <Bar dataKey="relevance" radius={[0, 4, 4, 0]}>
                    {allSkills.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.status === 'matched' 
                            ? COLORS.matched 
                            : entry.status === 'partial'
                            ? COLORS.partial
                            : COLORS.missing
                        } 
                      />
                    ))}
                  </Bar>
                  {/* Use a custom X axis that shows skill names */}
                  <svg>
                    {allSkills.map((skill, index) => (
                      <text
                        key={index}
                        x={10}
                        y={15 + index * 25}
                        textAnchor="start"
                        className="fill-gray-700 text-xs"
                      >
                        {skill.name.length > 20 
                          ? skill.name.substring(0, 20) + '...' 
                          : skill.name}
                      </text>
                    ))}
                  </svg>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="types" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius={90} data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Tooltip />
                  <Radar
                    name="Matched Skills"
                    dataKey="matched"
                    stroke={COLORS.matched}
                    fill={COLORS.matched}
                    fillOpacity={0.5}
                  />
                  <Radar
                    name="Partial Match"
                    dataKey="partial"
                    stroke={COLORS.partial}
                    fill={COLORS.partial}
                    fillOpacity={0.5}
                  />
                  <Radar
                    name="Missing Skills"
                    dataKey="missing"
                    stroke={COLORS.missing}
                    fill={COLORS.missing}
                    fillOpacity={0.5}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
