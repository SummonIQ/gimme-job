import React from 'react';
import styled from 'styled-components';
import budgetbloomScreenshot from '../../images/screenshot.png';

const CallToAction = () => (
  <Container>
    <Content>
      <Blurb></Blurb>

      <Illustration>
        <div />
      </Illustration>
    </Content>
  </Container>
);

const Container = styled.div`
  min-height: 619px;
`;

const Content = styled.div`
  margin: 0 auto;
  max-width: 960px;
  padding: 125px 0;

  &:after {
    clear: both;
    content: '';
    display: block;
  }
`;

const Blurb = styled.div`
  float: left;
  width: calc(100% - 40%);

  h1 {
    color: #3b3b3b;
    font-size: 42px;
    font-weight: 700;
    margin-bottom: 15px;
  }

  h3 {
    color: #9a9a9a;
    font-size: 24px;
    margin-bottom: 25px;
  }

  button {
    background: rgba(60, 60, 60, 1);
    border: none;
    border-radius: 50px;
    color: white;
    cursor: pointer;
    display: inline-block;
    font-size: 18px;
    font-weight: 600;
    margin-top: 25px;
    padding: 15px 22px;
    user-select: none;
    transition: background 0.2s ease-in;

    &:hover {
      background: rgba(0, 0, 0, 0.9);
    }

    &:active {
      background: rgba(0, 0, 0, 1);
    }
  }
`;

const Illustration = styled.div`
  float: right;
  padding: 0 0 0 50px;
  width: calc(100% - 60%);

  div {
    background: #eee;
    border-radius: 15px;
    height: 280px;
    width: 100%;
  }
`;

export default CallToAction;
