'use client';

import React from 'react';
import styled, { css } from 'styled-components';

const Button = ({
  childButton,
  children,
  className,
  darkMode,
  disabled,
  // fullWidth = false,
  id,
  onClick,
  onMouseEnter,
  onMouseLeave,
  primary = 'true',
  secondary = 'false',
  size,
  type,
  warning,
  ...props
}) => {
  if (childButton) {
    return (
      <ButtonContainer
        className={className}
        darkMode="true"
        disabled={disabled}
        // fullWidth={fullWidth}
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        primary="true"
        secondary="false"
        size={size}
        warning="false"
        {...props}
      >
        {React.cloneElement(children, { ...props })}
      </ButtonContainer>
    );
  }

  return (
    <Container
      className={className}
      darkMode={darkMode}
      disabled={disabled}
      // fullWidth={fullWidth}
      id={id}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      primary={primary}
      secondary={secondary.toString()}
      size={size}
      type="button"
      warning={warning}
      {...props}
    >
      {children}
    </Container>
  );
};

const Container = styled.button`
  background: rgba(60, 60, 60, 1);
  border: 2px solid transparent;
  border-radius: 50px;
  box-shadow: 0 5px 15px rgba(60, 60, 60, 0.4);
  color: white;
  cursor: pointer;
  display: inline-block;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 17px 11px 17px;
  transition: background 0.2s ease-in-out;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  &:active {
    background: rgba(0, 0, 0, 1);
  }

  ${props =>
    props.disabled &&
    css`
      pointer-events: none;
      opacity: 0.8;
    `};

  ${props =>
    props.primary &&
    css`
      background: rgb(65, 145, 64) !important;
      box-shadow: 0 5px 15px rgba(65, 145, 64, 0.5);
      color: white;

      &:hover {
        background: rgba(65, 145, 63, 0.9) !important;
      }

      &:active {
        background: rgba(65, 145, 63, 0.8) !important;
      }
    `}

  ${props =>
    props.secondary &&
    css`
      background: rgba(60, 60, 60, 0.1);
      box-shadow: none;
      color: rgba(60, 60, 60, 1);
      font-weight: 600;

      &:hover {
        background: rgba(60, 60, 60, 0.2);
      }

      &:active {
        background: rgba(60, 60, 60, 0.4);
      }
    `};

  ${props =>
    props.size === 'small' &&
    css`
      font-size: 11px;
      padding: 5px 11px 6px 11px;

      @media (min-width: 992px) {
        font-size: 11px;
        padding: 5px 11px 6px 11px;
      }
    `};

  ${props =>
    props.size === 'large' &&
    css`
      font-size: 13px;
      padding: 10px 17px 11px 17px;

      @media (min-width: 992px) {
        font-size: 15px;
        font-weight: 500;
        padding: 15px 22px 16px 22px;
      }
    `};

  ${props =>
    props.darkMode &&
    css`
      background: rgba(143, 231, 0, 1) !important;
      color: rgba(34, 37, 41, 1) !important;

      &:hover {
        background: rgba(143, 231, 0, 0.7) !important;
      }
      &:active {
        background: rgba(143, 231, 0, 0.6) !important;
      }
    `};

  ${props =>
    props.darkMode &&
    props.secondary &&
    css`
      background: transparent !important;
      border: 2px solid rgba(143, 231, 0, 0.7) !important;
      color: rgba(143, 231, 0, 1) !important;

      &:hover {
        background: rgba(143, 231, 0, 0.1) !important;
        border: 2px solid rgba(143, 231, 0, 0.7) !important;
        color: #1b1b1b;
      }

      &:active {
        background: rgba(143, 231, 0, 0.6) !important;
      }
    `};

  ${props =>
    props.warning &&
    css`
      background: rgba(237, 81, 66, 1) !important;
      box-shadow: 0 5px 15px rgba(237, 81, 66, 0.4);

      &:hover {
        background: rgba(237, 81, 66, 0.9) !important;
      }

      &:active {
        background: rgba(237, 81, 66, 0.8) !important;
      }
    `};

  ${props =>
    props.fullWidth &&
    css`
      border-radius: 8px;
      width: 100%;
    `};

  @media (min-width: 480px) {
  }

  @media (min-width: 768px) {
  }

  @media (min-width: 992px) {
  }

  @media (min-width: 1200px) {
  }
`;

const ButtonContainer = styled.div`
  button {
    background: rgba(60, 60, 60, 1) !important;
    border: none !important;
    border-radius: 50px !important;
    color: white !important;
    cursor: pointer !important;
    display: inline-block !important;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 17px 11px 17px !important;
    transition: background 0.1s ease-in-out;

    &:hover {
      background: rgba(0, 0, 0, 0.9) !important;
    }

    &:active {
      background: rgba(0, 0, 0, 1) !important;
    }
  }

  ${props =>
    props.primary &&
    css`
      button {
        background: rgb(65, 145, 64) !important;
        box-shadow: 0 5px 15px rgba(65, 145, 64, 0.5);
        color: white;

        &:hover {
          background: rgba(65, 145, 63, 0.9) !important;
        }

        &:active {
          background: rgba(65, 145, 63, 0.8) !important;
        }
      }
    `}

  ${props =>
    props.secondary &&
    css`
      button {
        background: rgba(230, 230, 230, 1) !important;
        color: #5b5b5b;

        &:hover {
          background: rgba(210, 210, 210, 0.9) !important;
        }

        &:active {
          background: rgba(210, 210, 210, 0.8) !important;
        }
      }
    `}

  ${props =>
    props.size === 'small' &&
    css`
      button {
        font-size: 11px;
        padding: 7px 12px 8px 12px;
      }

      @media (min-width: 992px) {
        button {
          font-size: 12px;
          padding: 10px 17px 11px 17px;
        }
      }
    `}

  ${props =>
    props.size === 'large' &&
    css`
      button {
        font-size: 13px;
        padding: 10px 17px 11px 17px;
      }

      @media (min-width: 992px) {
        button {
          font-size: 15px;
          padding: 15px 22px 16px 22px;
        }
      }
    `}

  ${props =>
    props.darkMode &&
    css`
      button {
        color: rgba(34, 37, 41, 1) !important;
        background: rgba(143, 231, 0, 1) !important;

        &:hover {
          background: rgba(143, 231, 0, 0.7) !important;
        }

        &:active {
          background: rgba(143, 231, 0, 0.6) !important;
        }
      }
    `};

  ${props =>
    props.warning &&
    css`
      button {
        background: rgba(255, 65, 54, 1) !important;

        &:hover {
          background: rgba(255, 65, 54, 1) !important;
        }

        &:active {
          background: rgba(255, 65, 54, 0.6) !important;
        }
      }
    `};
`;

export default Button;
