import React, { useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const ProductCardContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  background: ${({ theme }) => theme.cardBg};

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const ProductImage = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
`;

const ProductInfo = styled.div`
  padding: 1rem;
`;

const ProductTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
`;

const ProductPrice = styled.p`
  font-weight: bold;
  color: ${({ theme }) => theme.primary};
  margin: 0 0 0.5rem 0;
`;

const SizeSelector = styled.select`
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.inputBg};
  color: ${({ theme }) => theme.text};
`;

const QuantityInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.inputBg};
  color: ${({ theme }) => theme.text};
`;

const AddToCartButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;

  &:hover {
    background: ${({ theme }) => theme.primaryDark};
  }
`;

const ProductCard = ({ product, addToCart }) => {
  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState(1);

  const availableSizes = Object.entries(product.sizes)
    .filter(([_, qty]) => qty > 0)
    .map(([size]) => size);

  const handleAddToCart = () => {
    if (availableSizes.length > 0 && quantity > 0) {
      addToCart(product, size, quantity);
    }
  };

  return (
    <ProductCardContainer>
      <Link to={`/products/${product._id}`}>
        <ProductImage src={product.images[0]} alt={product.name} />
      </Link>
      <ProductInfo>
        <Link to={`/products/${product._id}`}>
          <ProductTitle>{product.name}</ProductTitle>
        </Link>
        <ProductPrice>{product.price} ج.م</ProductPrice>
        
        {availableSizes.length > 0 ? (
          <>
            <SizeSelector 
              value={size} 
              onChange={(e) => setSize(e.target.value)}
            >
              {availableSizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SizeSelector>
            
            <QuantityInput
              type="number"
              min="1"
              max="10"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
            />
            
            <AddToCartButton onClick={handleAddToCart}>
              أضف إلى السلة
            </AddToCartButton>
          </>
        ) : (
          <p>غير متوفر حالياً</p>
        )}
      </ProductInfo>
    </ProductCardContainer>
  );
};

export default ProductCard;