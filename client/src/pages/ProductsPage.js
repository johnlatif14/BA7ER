import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ProductCard from '../components/ProductCard';
import axios from 'axios';
import { CircularProgress } from '@mui/material';

const ProductsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  padding: 2rem;
`;

const ProductsPage = ({ addToCart }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await axios.get('/api/products');
        setProducts(data);
        setLoading(false);
      } catch (err) {
        setError('حدث خطأ أثناء جلب المنتجات. يرجى المحاولة مرة أخرى لاحقاً.');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <div>{error}</div>;

  return (
    <ProductsContainer>
      {products.map(product => (
        <ProductCard 
          key={product._id} 
          product={product} 
          addToCart={addToCart} 
        />
      ))}
    </ProductsContainer>
  );
};

export default ProductsPage;