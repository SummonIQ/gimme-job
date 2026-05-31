'use client';

import React from 'react';
import styled from 'styled-components';

const FeatureIcon = ({ alt, icon, className }) => {
  const getIcon = () => {
    switch (icon) {
      case 'credit-card-balance':
        return '/images/icons/credit-card-balance.svg';
      case 'credit-card-utilization':
        return '/images/icons/credit-utilization-2.svg';
      case 'credit-card-balancing':
        return '/images/icons/credit-card-utilization-1.svg';
      case 'discretionary-expenses':
        return '/images/icons/discretionary-expenses-2.svg';
      case 'investment-value':
        return '/images/icons/investment-value.svg';
      case 'net-worth-1':
        return '/images/icons/net-worth-1.svg';
      case 'net-worth-2':
        return '/images/icons/net-worth-2.svg';
      case 'non-discretionary-expenses':
        return '/images/icons/non-discretionary-expenses-2.svg';
      case 'over-budget-1':
        return '/images/icons/over-budget-1.svg';
      case 'over-budget-2':
        return '/images/icons/over-budget-2.svg';
      case 'total-debt':
        return '/images/icons/total-debt.svg';

      default:
        return '';
    }
  };
  return (
    <Container className={className}>
      <img alt={alt} src={getIcon()} />
    </Container>
  );
};

const Container = styled.div`
  //background: #ddd;
  border-radius: 64px;
  float: left;
  height: 64px;
  margin: 0 15px 0 0;
  width: 64px;

  img {
    max-height: 52px;
    max-width: 52px;
  }

  @media (min-width: 480px) {
  }

  @media (min-width: 768px) {
    margin: 0 25px 0 0;
  }

  @media (min-width: 992px) {
  }

  @media (min-width: 1200px) {
  }
`;

export default FeatureIcon;
