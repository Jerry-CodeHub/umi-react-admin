import styled from 'styled-components';

export const SignatureStyle = styled.div`
  .wrapper {
    position: relative;
    width: 600px;
    height: 300px;
    -moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  .signature-pad {
    position: absolute;
    left: 0;
    top: 0;
    width: 600px;
    height: 300px;
    background-color: white;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
  }
`;
