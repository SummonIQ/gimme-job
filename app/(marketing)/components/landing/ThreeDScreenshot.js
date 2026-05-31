import React from 'react';
import styled from 'styled-components';
import mainScreen from '../../images/screens/dashboard-cropped.png';
import budgetBreakDown from '../../images/screens/budget-breakdown-2.png';
import titleCard1 from '../../images/screens/title-card-1.png';
import titleCard2 from '../../images/screens/title-card-2.png';
import titleCard3 from '../../images/screens/title-card-3.png';
import upcomingBills from '../../images/screens/upcoming-bills.png';
import expenseSidebar from '../../images/screens/expense-sidebar.png';
import cardSidebar from '../../images/screens/card-sidebar.png';
import inAGlance from '../../images/screens/in-a-glance.png';

const ThreeDScreenshot = () => {
  return (
    <Container>
      {/*<img*/}
      {/*  alt="Screenshot of the Overview dashboard page of BudgetBloom personal finance and budgeting app"*/}
      {/*  src={mainScreen}*/}
      {/*/>*/}
      <Block>
        <div className="canvas">
          <img className="budget-breakdown" src={budgetBreakDown} />

          <img className="main" src={mainScreen} />

          <div id="title-cards">
            <img id="title-card-1" className="title-card" src={titleCard1} />
            <img id="title-card-2" className="title-card" src={titleCard2} />
            <img id="title-card-3" className="title-card" src={titleCard3} />
            {/* <img id="title-card-4" class="title-card" src="title-card-4.png" />*/}
          </div>

          <img className="upcoming-bills" src={upcomingBills} />

          <img id="expense-card" src={expenseSidebar} />
          <img className="card-sidebar" src={cardSidebar} />

          <img id="in-a-glance" src={inAGlance} />
        </div>
      </Block>
    </Container>
  );
};

const Block = styled.div`
  height: 2000px;
  position: relative;
  width: 100%;
`;

const Container = styled.div`
  height: 900px;
  perspective: 1000px;
  left: 0;
  right: 0;

  .canvas {
    margin: 200px 50px;
    position: relative;
    text-align: center;
    transform-origin: top center;
    transform: rotateX(20deg);
  }

  img.main {
    border-radius: 15px;
    box-shadow: -5px 35px 50px 25px rgba(0, 0, 0, 0.2);
    width: 800px;
  }

  img.budget-breakdown {
    background: white;
    border-radius: 15px;
    box-shadow: -5px 35px 50px 25px rgb(0 0 0 / 20%);
    padding-bottom: 10px;
    position: absolute;
    top: 115px;
    left: 360px;
    width: 270px;
    transform: scale(1.05);
    /*    transform: rotateX(-10deg);*/
  }

  img.upcoming-bills {
    border-radius: 15px;
    box-shadow: -5px 35px 50px 25px rgb(0 0 0 / 20%);
    position: absolute;
    top: -20px;
    right: 220px;
    width: 280px;
    transform: scale(1.05);
  }

  img.card-sidebar {
    border-radius: 15px;
    box-shadow: -5px 35px 50px 25px rgb(0 0 0 / 20%);
    position: absolute;
    bottom: 0px;
    /*    left: 200px;*/
    width: 200px;
    transform: scale(1.2) rotateX(20deg);
    right: 380px;
  }

  #title-cards {
    left: -15px;
    position: absolute;
    top: 80px;
  }

  img.title-card {
    border-radius: 10px;
    box-shadow: -5px 35px 50px 25px rgb(0 0 0 / 20%);
    position: absolute;
    top: 0;
    left: 0;
    width: 200px;
    z-index: 500;
  }

  img#title-card-3 {
    left: 320px;
    top: -130px;
    /*width: 250px;*/
  }

  img#title-card-2 {
    left: 250px;
    top: -50px;
    /*width: 250px;*/
  }

  img#title-card-1 {
    left: 290px;
    top: 30px;
    /*width: 250px;*/
  }

  img#title-card-4 {
    left: 320px;
    top: -120px;
    /*width: 250px;*/
  }

  img#expense-card {
    border-radius: 15px;
    box-shadow: -5px 20px 50px 25px rgb(0 0 0 / 20%);
    position: absolute;
    top: 60px;
    right: 530px;
    width: 220px;
  }

  img#in-a-glance {
    border-radius: 15px;
    box-shadow: -5px 20px 50px 25px rgb(0 0 0 / 20%);
    position: absolute;
    right: 590px;
    top: -32px;
    width: 200px;
    transform: scale(1.1);
  }
`;

export default ThreeDScreenshot;
