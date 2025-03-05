"use client";

import React, { useEffect, useRef } from 'react';
import PointCloudAnimation from '../components/PointCloudAnimation';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.pointCloudContainer}>
        <PointCloudAnimation />
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.description}>
          Discover the power of connected intelligence
        </p>
      </div>
    </main>
  );
}





