import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';

const CartContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const CartTitle = styled.h1`
  margin-bottom: 2rem;
`;

const CartItems = styled.div`
  margin-bottom: 2rem;
`;

const CartSummary = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border};
  padding-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TotalPrice = styled.p`
  font-size: 1.2rem;
  font-weight: bold;
`;

const CheckoutButton = styled(Link)`
  background: ${({ theme }) => theme.primary};
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  text-decoration: none;
  font-weight: bold;
  transition: background 0.3s;

  &:hover {
    background: ${({ theme }) => theme.primaryDark};
  }
`;

const EmptyCart = styled.div`
  text-align: center;
  padding: 2rem;
`;

const CartPage = ({ cart, setCart }) => {
  const updateQuantity = (index, newQuantity) => {
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    setCart(newCart);
  };

  const removeItem = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + (item.product.price * item.quantity), 
    0
  );

  return (
    <CartContainer>
      <CartTitle>سلة التسوق</CartTitle>
      
      {cart.length === 0 ? (
        <EmptyCart>
          <p>سلة التسوق فارغة</p>
          <Link to="/products">تصفح المنتجات</Link>
        </EmptyCart>
      ) : (
        <>
          <CartItems>
            {cart.map((item, index) => (
              <CartItem
                key={`${item.product._id}-${item.size}`}
                item={item}
                updateQuantity={(qty) => updateQuantity(index, qty)}
                removeItem={() => removeItem(index)}
              />
            ))}
          </CartItems>
          
          <CartSummary>
            <TotalPrice>المجموع: {totalPrice} ج.م</TotalPrice>
            <CheckoutButton to="/checkout">إتمام الشراء</CheckoutButton>
          </CartSummary>
        </>
      )}
    </CartContainer>
  );
};

export default CartPage;