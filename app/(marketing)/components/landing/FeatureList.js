import React from 'react';
import styled from 'styled-components';
import { Link } from 'gatsby';

const FeatureList = () => (
  <Container>
    <h2>Why should you use BudgetBloom for your personal budgeting?</h2>

    <Features>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>Everything in view.</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>An Overview of how you are spending and saving let's you know where you stand.</li>
            <li>Velit esse cillum dolore eu fugiat nulla pariatur.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>Create custom budgets that fit your spending habits.</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>Create custom spending categories.</li>
            <li>Know when you're spending too much.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>Track spending and saving over time.</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>Duis aute irure dolor in reprehenderit in voluptate.</li>
            <li>Velit esse cillum dolore eu fugiat nulla pariatur.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>Know your credit card's rewards to save even more.</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>Duis aute irure dolor in reprehenderit in voluptate.</li>
            <li>Velit esse cillum dolore eu fugiat nulla pariatur.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>Your data is secure.</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>Duis aute irure dolor in reprehenderit in voluptate.</li>
            <li>Velit esse cillum dolore eu fugiat nulla pariatur.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
      <Feature>
        <Illustration />
        <Blurb>
          <h5>And more!</h5>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat
          </p>

          <ul>
            <li>Duis aute irure dolor in reprehenderit in voluptate.</li>
            <li>Velit esse cillum dolore eu fugiat nulla pariatur.</li>
            <li>Excepteur sint occaecat cupidatat non proident, sunt in culpa.</li>
          </ul>
        </Blurb>
      </Feature>
    </Features>
  </Container>
);

const Container = styled.div`
  h2 {
    color: #999;
    font-size: 24px;
    font-weight: 700;
    margin: 50px 0;
    text-align: center;
  }
`;

const Features = styled.div`
  &:after {
    clear: both;
    content: '';
    display: block;
  }
`;

const Feature = styled.div`
  // background-color: white;
  // border-radius: 25px;
  margin: 0 0 25px 0;
  padding: 50px 0;

  &:after {
    clear: both;
    content: '';
    display: block;
  }
`;

const Blurb = styled.div`
  float: right;
  width: calc(100% - 30%);

  h5 {
    color: #5b5b5b;
    font-size: 32px;
    font-weight: 700;
    margin: 4px 0 15px 0;
  }

  p {
    color: #5b5b5b;
    font-size: 18px;
    line-height: 24px;
    margin: 0 0 25px 0;
  }

  ul {
    padding: 0 25px;

    li {
      color: #5b5b5b;
      font-size: 16px;
      line-height: 28px;
    }
  }
`;

const Illustration = styled.div`
  float: left;
  padding: 0 35px 0 0;
  width: calc(100% - 70%);

  &:before {
    background: #eee;
    border-radius: 15px;
    content: '';
    display: block;
    height: 260px;
    width: 100%;
  }
`;

export default FeatureList;
