import 'package:flutter/material.dart';

void main() {
  runApp(const GroupHubApp());
}

class GroupHubApp extends StatelessWidget {
  const GroupHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'GroupHub',
      theme: ThemeData(
        // 1. Updated to Orange to match your logo!
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.orange),
        useMaterial3: true,
      ),
      home: const LandingPage(),
    );
  }
}

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // 2. This is where your logo will go soon!
        title: const Text('GroupHub'),
        backgroundColor: Colors.white,
        elevation: 1,
      ),
      drawer: Drawer(
        child: ListView(
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: Colors.orange),
              child: Text(
                'Menu',
                style: TextStyle(color: Colors.white, fontSize: 24),
              ),
            ),
            ListTile(title: const Text('Dashboard'), onTap: () {}),
            ListTile(title: const Text('Chat'), onTap: () {}),
            ListTile(title: const Text('Login'), onTap: () {}),
            ListTile(title: const Text('Sign Up'), onTap: () {}),
          ],
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Hero Section
            Container(
              height: 300,
              width: double.infinity,
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: AssetImage('assets/students.jpg'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                color: Colors.black.withOpacity(0.4),
                child: const Center(
                  child: Text(
                    'Collaborate Smarter.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),

            const Padding(
              padding: EdgeInsets.all(20.0),
              child: Text(
                'What is GroupHub?',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ),

            // Feature Cards
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Column(
                children: [
                  buildInfoCard(
                    'Easy Groups',
                    'Create and manage study groups in seconds.',
                    Icons.group,
                  ),
                  buildInfoCard(
                    'Real-time Chat',
                    'Talk to your teammates instantly.',
                    Icons.chat,
                  ),
                  buildInfoCard(
                    'Project Tracking',
                    'Keep your assignments on schedule.',
                    Icons.task,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget buildInfoCard(String title, String subtitle, IconData icon) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 10),
      child: ListTile(
        leading: Icon(
          icon,
          color: Colors.orange,
          size: 40,
        ), // Icons now match the logo
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(subtitle),
      ),
    );
  }
}
