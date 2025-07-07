export const lightTheme = {
  body: '#f5f5f5',
  text: '#333',
  primary: '#4a6fa5',
  primaryDark: '#3a5a80',
  navBg: '#ffffff',
  cardBg: '#ffffff',
  border: '#e0e0e0',
  inputBg: '#ffffff'
};

export const darkTheme = {
  body: '#1a1a1a',
  text: '#f5f5f5',
  primary: '#6c8fc7',
  primaryDark: '#5a7db0',
  navBg: '#2a2a2a',
  cardBg: '#2a2a2a',
  border: '#444',
  inputBg: '#333'
};

export const GlobalStyles = styled.createGlobalStyle`
  body {
    background: ${({ theme }) => theme.body};
    color: ${({ theme }) => theme.text};
    font-family: 'Tajawal', sans-serif;
    transition: all 0.25s linear;
    margin: 0;
    padding: 0;
    direction: rtl;
  }

  a {
    color: ${({ theme }) => theme.text};
    text-decoration: none;
  }

  button {
    font-family: 'Tajawal', sans-serif;
  }

  input, select, textarea {
    font-family: 'Tajawal', sans-serif;
  }
`;