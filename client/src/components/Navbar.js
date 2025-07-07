import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { FaShoppingCart, FaMoon, FaSun } from 'react-icons/fa';

const NavbarContainer = styled.nav`
  background: ${({ theme }) => theme.navBg};
  color: ${({ theme }) => theme.text};
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.text};
  text-decoration: none;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 1.5rem;
`;

const NavLink = styled(Link)`
  color: ${({ theme }) => theme.text};
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;

  &:hover {
    color: ${({ theme }) => theme.primary};
  }
`;

const CartIcon = styled(Link)`
  position: relative;
  color: ${({ theme }) => theme.text};
  text-decoration: none;
`;

const CartCount = styled.span`
  position: absolute;
  top: -8px;
  right: -8px;
  background: ${({ theme }) => theme.primary};
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
`;

const ThemeToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.text};
  cursor: pointer;
  font-size: 1.2rem;
`;

const Navbar = ({ cartCount, toggleTheme }) => {
  return (
    <NavbarContainer>
      <Logo to="/">متجر الملابس</Logo>
      <NavLinks>
        <NavLink to="/">الرئيسية</NavLink>
        <NavLink to="/products">المنتجات</NavLink>
        <NavLink to="/contact">اتصل بنا</NavLink>
        <ThemeToggle onClick={toggleTheme}>
          {theme => theme === 'light' ? <FaMoon /> : <FaSun />}
        </ThemeToggle>
        <CartIcon to="/cart">
          <FaShoppingCart />
          <CartCount>{cartCount}</CartCount>
        </CartIcon>
      </NavLinks>
    </NavbarContainer>
  );
};

export default Navbar;