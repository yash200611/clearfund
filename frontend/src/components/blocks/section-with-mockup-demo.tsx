import React from 'react'
import SectionWithMockup from '@/components/ui/section-with-mockup'

const analyticsSectionData = {
  title: (
    <>
      Analytics,
      <br />
      built for trust.
    </>
  ),
  description: (
    <>
      See campaign performance, escrow flow, and milestone outcomes
      <br />
      in one view. Track what was raised, what was released, and what
      <br />
      is still protected in escrow with clean, verifiable reporting.
    </>
  ),
  primaryImageSrc: 'https://source.unsplash.com/1200x1800/?analytics,dashboard',
  secondaryImageSrc: 'https://source.unsplash.com/1200x1800/?finance,chart',
}

export function SectionMockupDemoPage() {
  return (
    <SectionWithMockup
      title={analyticsSectionData.title}
      description={analyticsSectionData.description}
      primaryImageSrc={analyticsSectionData.primaryImageSrc}
      secondaryImageSrc={analyticsSectionData.secondaryImageSrc}
    />
  )
}
